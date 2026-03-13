package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.DTO.IdentityFeaturesDTO;
import com.mulehunter.backend.DTO.EifResponse;
import com.mulehunter.backend.model.AiRiskResult;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.Duration;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;
    private final VisualAnalyticsService visualAnalyticsService;
    private final Ja3SecurityService ja3SecurityService;
    private final AiRiskService aiRiskService;
    private final TransactionValidationService validationService;
    private final IdentityCollectorService identityCollectorService;
    private final AggregateUpdateService aggregateUpdateService;
    private final BehaviorFeatureService behaviorFeatureService;
    private final GraphFeatureService graphFeatureService;
    private final EifService eifService;

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,
            VisualAnalyticsService visualAnalyticsService,
            Ja3SecurityService ja3SecurityService,
            AiRiskService aiRiskService,
            TransactionValidationService validationService,
            IdentityCollectorService identityCollectorService,
            AggregateUpdateService aggregateUpdateService,
            BehaviorFeatureService behaviorFeatureService,
            GraphFeatureService graphFeatureService,
            EifService eifService
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        this.visualAnalyticsService = visualAnalyticsService;
        this.ja3SecurityService = ja3SecurityService;
        this.aiRiskService = aiRiskService;
        this.validationService = validationService;
        this.identityCollectorService = identityCollectorService;
        this.aggregateUpdateService = aggregateUpdateService;
        this.behaviorFeatureService = behaviorFeatureService;
        this.graphFeatureService = graphFeatureService;
        this.eifService = eifService;
    }

    public Mono<Transaction> createTransaction(TransactionRequest request, String ja3) {

        return validationService.validate(request)
                .then(Mono.defer(() -> {

                    Transaction tx = Transaction.from(request);

                    Long sourceNodeId;
                    Long targetNodeId;

                    try {
                        sourceNodeId = Long.parseLong(tx.getSourceAccount());
                        targetNodeId = Long.parseLong(tx.getTargetAccount());
                    } catch (Exception e) {
                        return Mono.error(new IllegalArgumentException("Invalid node IDs", e));
                    }

                    double amount = tx.getAmount().doubleValue();
                    String sourceAcc = tx.getSourceAccount();
                    String targetAcc = tx.getTargetAccount();
                    String deviceHash = "device-" + sourceAcc;
                    String ip = "127.0.0.1";

                    return repository.save(tx)

                            // Identity Forensics
                            .flatMap(savedTx ->
                                    identityCollectorService.collect(savedTx, ja3, deviceHash, ip)
                            )

                            // Aggregates
                            .flatMap(savedTx ->
                                    aggregateUpdateService.update(
                                            sourceAcc,
                                            targetAcc,
                                            amount,
                                            savedTx.getTransactionId(),
                                            ja3,
                                            deviceHash,
                                            ip
                                    ).thenReturn(savedTx)
                            )

                            // Feature computation
                            .flatMap(savedTx ->
                                    Mono.zip(
                                            behaviorFeatureService.compute(sourceAcc, amount),
                                            graphFeatureService.compute(sourceAcc)
                                    ).flatMap(features -> {

                                        BehaviorFeaturesDTO behavior = features.getT1();
                                        GraphFeaturesDTO graph = features.getT2();

                                        IdentityFeaturesDTO identity = new IdentityFeaturesDTO(
                                                savedTx.getJa3ReuseCount() != null ? savedTx.getJa3ReuseCount() : 0,
                                                savedTx.getDeviceReuseCount() != null ? savedTx.getDeviceReuseCount() : 0,
                                                savedTx.getIpReuseCount() != null ? savedTx.getIpReuseCount() : 0,
                                                false,
                                                Boolean.TRUE.equals(savedTx.getIsNewDevice()),
                                                Boolean.TRUE.equals(savedTx.getIsNewJa3())
                                        );

                                        List<Double> eifFeatures = List.of(
                                                behavior.getTransactionVelocityScore(),
                                                behavior.getBurstScore(),
                                                (double) graph.getSuspiciousNeighborCount(),
                                                (double) identity.getJa3ReuseCount(),
                                                (double) identity.getDeviceReuseCount(),
                                                (double) identity.getIpReuseCount()
                                        );

                                        System.out.printf(
                                                "📦 ML PAYLOAD: account=%s velocity=%.1f burst=%.1f suspiciousNeighbors=%d%n",
                                                sourceAcc,
                                                behavior.getTransactionVelocityScore(),
                                                behavior.getBurstScore(),
                                                graph.getSuspiciousNeighborCount()
                                        );

                                        // fire and forget enrichment
                                        Mono.when(
                                                nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                                nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                                visualAnalyticsService.triggerVisualMlPipeline(savedTx)
                                        ).subscribe();

                                        // EIF call
                                        Mono<EifResponse> eifMono =
                                                eifService.score(eifFeatures)
                                                        .timeout(Duration.ofMillis(1000))
                                                        .onErrorReturn(new EifResponse());

                                        return Mono.zip(
                                                aiRiskService.analyzeTransaction(
                                                        sourceNodeId,
                                                        targetNodeId,
                                                        amount,
                                                        behavior,
                                                        graph,
                                                        identity
                                                ).defaultIfEmpty(new AiRiskResult()),
                                                eifMono
                                        ).flatMap(tuple -> {

                                            AiRiskResult aiResult = tuple.getT1();
                                            EifResponse eifResp = tuple.getT2();

                                            double eifScore = eifResp.getScore();
                                            Map<String, Double> eifFactors = eifResp.getTopFactors();

                                            // Store GNN
                                            savedTx.setGnnScore(aiResult.getRiskScore());

                                            if (aiResult.getConfidence() != null) {
                                                savedTx.setGnnConfidence(aiResult.getConfidence());
                                            }

                                            savedTx.setUnsupervisedModelName(aiResult.getModelVersion());
                                            savedTx.setLinkedAccounts(aiResult.getLinkedAccounts());

                                            // Store EIF
                                            savedTx.setUnsupervisedScore(eifScore);

                                            if (eifFactors != null) {
                                                savedTx.setEifTopFactors(eifFactors.toString());
                                            }

                                            if (eifResp.getExplanation() != null) {
                                                savedTx.setEifExplanation(eifResp.getExplanation());
                                            }

                                            return Mono.just(savedTx);
                                        })

                                        // JA3 Risk
                                        .flatMap(tx2 ->
                                                ja3SecurityService.callJa3Risk(tx2, ja3)
                                                        .defaultIfEmpty(new HashMap<>())
                                                        .doOnNext(ja3Result -> {

                                                            Object riskObj = ja3Result.get("ja3Risk");
                                                            Object velocityObj = ja3Result.get("velocity");
                                                            Object fanoutObj = ja3Result.get("fanout");

                                                            if (riskObj instanceof Number n) {
                                                                tx2.setJa3Risk(n.doubleValue());
                                                                tx2.setJa3Detected(n.doubleValue() > 0.7);
                                                            }

                                                            if (velocityObj instanceof Number n)
                                                                tx2.setJa3Velocity(n.intValue());

                                                            if (fanoutObj instanceof Number n)
                                                                tx2.setJa3Fanout(n.intValue());
                                                        })
                                                        .thenReturn(tx2)
                                        )

                                        .flatMap(finalTx -> {
                                            combineRiskSignals(finalTx, behavior, graph);
                                            return repository.save(finalTx);
                                        });

                                    })
                            );
                }));
    }

    private void combineRiskSignals(
            Transaction tx,
            BehaviorFeaturesDTO behavior,
            GraphFeaturesDTO graph
    ) {

        double gnnScore = tx.getGnnScore() == null ? 0.0 : tx.getGnnScore();
        double eifScore = tx.getUnsupervisedScore() == null ? 0.0 : tx.getUnsupervisedScore();
        double ja3Score = tx.getJa3Risk() == null ? 0.0 : tx.getJa3Risk();

        double velocity = behavior.getTransactionVelocityScore();
        double burst = behavior.getBurstScore();

        double behaviorScore =
                velocity * 0.3 +
                burst * 0.5 +
                behavior.getAvgAmountDeviation() * 0.2;

        double graphScore =
                graph.getConnectivityScore() * 0.6 +
                graph.getTwoHopFraudDensity() * 0.4;

        double raw =
                0.40 * gnnScore +
                0.10 * eifScore +
                0.30 * Math.min(behaviorScore, 1.0) +
                0.20 * Math.min(graphScore, 1.0);

        double finalRisk = Math.round(raw * 10000.0) / 10000.0;
        finalRisk = Math.max(0.0, Math.min(1.0, finalRisk));

        System.out.printf(
                "🔢 RISK COMBINE: gnn=%.4f behavior=%.2f graph=%.2f ja3=%.2f → FINAL=%.4f%n",
                gnnScore,
                behaviorScore,
                graphScore,
                ja3Score,
                finalRisk
        );

        tx.setRiskScore(finalRisk);
        tx.setSuspectedFraud(finalRisk > 0.6);

        tx.setBehaviorScore(behaviorScore);
        tx.setGraphScore(graphScore);
        tx.setVelocityScore(velocity);
        tx.setBurstScore(burst);

        String verdict =
                finalRisk >= 0.75 ? "BLOCK"
                        : finalRisk >= 0.45 ? "REVIEW"
                        : "APPROVE";

        tx.setVerdict(verdict);

        System.out.printf("🛡️ DECISION = %s | score=%.4f%n", verdict, finalRisk);
    }
}