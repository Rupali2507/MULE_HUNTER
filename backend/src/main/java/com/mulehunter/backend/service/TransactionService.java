package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.model.AiRiskResult;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;
    private final VisualAnalyticsService visualAnalyticsService;
    private final Ja3SecurityService ja3SecurityService;
    private final AiRiskService aiRiskService;
    private final TransactionValidationService validationService;
    private final IdentityCollectorService identityCollectorService;
    private final BehaviorFeatureService behaviorFeatureService;
    private final GraphFeatureService graphFeatureService;
    private final AggregateUpdateService aggregateUpdateService;

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,
            VisualAnalyticsService visualAnalyticsService,
            Ja3SecurityService ja3SecurityService,
            AiRiskService aiRiskService,
            TransactionValidationService validationService,
            IdentityCollectorService identityCollectorService,
            BehaviorFeatureService behaviorFeatureService,
            GraphFeatureService graphFeatureService,
            AggregateUpdateService aggregateUpdateService
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        this.visualAnalyticsService = visualAnalyticsService;
        this.ja3SecurityService = ja3SecurityService;
        this.aiRiskService = aiRiskService;
        this.validationService = validationService;
        this.identityCollectorService = identityCollectorService;
        this.behaviorFeatureService = behaviorFeatureService;
        this.graphFeatureService = graphFeatureService;
        this.aggregateUpdateService = aggregateUpdateService;
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

                    return repository.save(tx)

                            // Step 3 — Identity forensics
                            .flatMap(savedTx ->
                                    identityCollectorService.collect(
                                            savedTx, ja3,
                                            "device-" + savedTx.getSourceAccount(),
                                            "127.0.0.1"
                                    )
                            )

                            // Step 4 — Update aggregates + visual + node enrichment (parallel)
                            .flatMap(savedTx ->
                                    Mono.when(
                                            aggregateUpdateService.update(
                                                    sourceAcc, targetAcc, amount,
                                                    savedTx.getTransactionId(),
                                                    ja3,
                                                    "device-" + sourceAcc,
                                                    "127.0.0.1"
                                            ),
                                            nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                            nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                            visualAnalyticsService.triggerVisualMlPipeline(savedTx)
                                    ).thenReturn(savedTx)
                            )

                            // Steps 5+6 — Behavioral + Graph features (parallel)
                            .flatMap(savedTx ->
                                    Mono.zip(
                                            behaviorFeatureService.compute(sourceAcc, amount),
                                            graphFeatureService.compute(sourceAcc)
                                    ).flatMap(features -> {

                                        BehaviorFeaturesDTO behavior = features.getT1();
                                        GraphFeaturesDTO graph = features.getT2();

                                        System.out.printf("📦 ML PAYLOAD: account=%s velocity=%.1f burst=%.1f suspiciousNeighbors=%d%n",
                                                sourceAcc,
                                                behavior.getTransactionVelocityScore(),
                                                behavior.getBurstScore(),
                                                graph.getSuspiciousNeighborCount());

                                        // Step 7 — AI + JA3 in parallel
                                        return Mono.zip(
                                                aiRiskService.analyzeTransaction(sourceNodeId, targetNodeId, amount)
                                                        .defaultIfEmpty(new AiRiskResult()),
                                                ja3SecurityService.callJa3Risk(savedTx, ja3)
                                                        .defaultIfEmpty(Map.of()),
                                                aiRiskService.scoreEif(
                                                        behavior.getTotalIn24h(),
                                                        behavior.getTotalOut24h(),
                                                        behavior.getTransactionVelocityScore(),
                                                        behavior.getBurstScore(),
                                                        behavior.getUniqueCounterparties7d(),
                                                        behavior.getAvgAmountDeviation()
                                                )
                                        ).map(results -> {

                                            AiRiskResult ai = results.getT1();
                                            Map<String, Object> ja3Map = results.getT2();
                                            Map<String, Object> eifMap = results.getT3();

                                            // ── EIF ─────────────────────
                                            double eifScore = eifMap.get("score") instanceof Number n ? n.doubleValue() : 0.0;
                                            savedTx.setUnsupervisedScore(eifScore);
                                            savedTx.setEifExplanation((String) eifMap.getOrDefault("explanation", ""));
                                            savedTx.setEifTopFactors((Map<String, Double>) eifMap.getOrDefault("topFactors", Map.of()));

                                            // ── GNN ─────────────────────
                                            savedTx.setGnnScore(ai.getGnnScore());
                                            savedTx.setGnnConfidence(ai.getConfidence());
                                            savedTx.setRiskLevel(ai.getRiskLevel());
                                            savedTx.setVerdict(ai.getVerdict());
                                            savedTx.setSuspectedFraud(ai.isSuspectedFraud());

                                            savedTx.setSuspiciousNeighbors(ai.getSuspiciousNeighbors());
                                            savedTx.setSharedDevices(ai.getSharedDevices());
                                            savedTx.setSharedIPs(ai.getSharedIPs());

                                            savedTx.setClusterId(ai.getClusterId());
                                            savedTx.setClusterSize(ai.getClusterSize());

                                            savedTx.setMuleRingMember(ai.isMuleRingMember());
                                            savedTx.setRingShape(ai.getRingShape());
                                            savedTx.setRingSize(ai.getRingSize());
                                            savedTx.setRole(ai.getRole());
                                            savedTx.setHubAccount(ai.getHubAccount());
                                            savedTx.setRingAccounts(ai.getRingAccounts());

                                            savedTx.setRiskFactors(ai.getRiskFactors());
                                            savedTx.setEmbeddingNorm(ai.getEmbeddingNorm());

                                            // ── JA3 ─────────────────────
                                            if (ja3Map.get("ja3Risk") instanceof Number n) {
                                                savedTx.setJa3Risk(n.doubleValue());
                                                savedTx.setJa3Detected(n.doubleValue() > 0.7);
                                            }
                                            if (ja3Map.get("velocity") instanceof Number n)
                                                savedTx.setJa3Velocity(n.intValue());
                                            if (ja3Map.get("fanout") instanceof Number n)
                                                savedTx.setJa3Fanout(n.intValue());

                                            // ── FINAL RISK ──────────────
                                            combineRiskSignals(savedTx, behavior, graph, ai);

                                            // ── BUILD NESTED (FINAL) ───

                                            Map<String, Object> scores = new LinkedHashMap<>();
                                            scores.put("gnn", savedTx.getGnnScore());
                                            scores.put("eif", savedTx.getUnsupervisedScore());
                                            scores.put("behavior", savedTx.getBehaviorScore());
                                            scores.put("graph", savedTx.getGraphScore());
                                            scores.put("ja3", savedTx.getJa3Risk());
                                            scores.put("confidence", savedTx.getGnnConfidence());
                                            scores.put("eifExplanation", savedTx.getEifExplanation());
                                            scores.put("eifTopFactors", savedTx.getEifTopFactors());
                                            savedTx.setModelScores(scores);

                                            Map<String, Object> network = new LinkedHashMap<>();
                                            network.put("suspiciousNeighbors", savedTx.getSuspiciousNeighbors());
                                            network.put("sharedDevices", savedTx.getSharedDevices());
                                            network.put("sharedIPs", savedTx.getSharedIPs());
                                            network.put("centralityScore", null);
                                            network.put("transactionLoops", null);
                                            savedTx.setNetworkMetrics(network);

                                            Map<String, Object> cluster = new LinkedHashMap<>();
                                            cluster.put("clusterId", savedTx.getClusterId());
                                            cluster.put("clusterSize", savedTx.getClusterSize());
                                            cluster.put("clusterRiskScore", null);
                                            savedTx.setFraudCluster(cluster);

                                            Map<String, Object> ring = new LinkedHashMap<>();
                                            ring.put("isMuleRingMember", savedTx.getMuleRingMember());
                                            ring.put("ringShape", savedTx.getRingShape());
                                            ring.put("ringSize", savedTx.getRingSize());
                                            ring.put("role", savedTx.getRole());
                                            ring.put("hubAccount", savedTx.getHubAccount());
                                            ring.put("ringAccounts", savedTx.getRingAccounts());
                                            savedTx.setMuleRingDetection(ring);

                                            Map<String, Object> ja3Sec = new LinkedHashMap<>();
                                            ja3Sec.put("ja3Risk", savedTx.getJa3Risk());
                                            ja3Sec.put("ja3Detected", savedTx.getJa3Detected());
                                            ja3Sec.put("velocity", savedTx.getJa3Velocity());
                                            ja3Sec.put("fanout", savedTx.getJa3Fanout());
                                            ja3Sec.put("isNewDevice", savedTx.getIsNewDevice());
                                            ja3Sec.put("isNewJa3", savedTx.getIsNewJa3());
                                            savedTx.setJa3Security(ja3Sec);

                                            return savedTx;
                                        });
                                    })
                            )

                            .flatMap(repository::save);
                }));
    }

    private void combineRiskSignals(Transaction tx,
                                    BehaviorFeaturesDTO behavior,
                                    GraphFeaturesDTO graph,
                                    AiRiskResult ai) {

        double gnn = tx.getGnnScore() == null ? 0 : tx.getGnnScore();
        double eif = tx.getUnsupervisedScore() == null ? 0 : tx.getUnsupervisedScore();
        double ja3 = tx.getJa3Risk() == null ? 0 : tx.getJa3Risk();

        double behaviorScore = Math.min(
                behavior.getTransactionVelocityScore() * 0.3 +
                behavior.getBurstScore() * 0.5 +
                behavior.getAvgAmountDeviation() * 0.2, 1);

        double graphScore = Math.min(
                graph.getConnectivityScore() * 0.6 +
                graph.getTwoHopFraudDensity() * 0.4, 1);

        double finalRisk = Math.min(
                0.35 * gnn +
                0.10 * eif +
                0.25 * behaviorScore +
                0.15 * graphScore +
                0.10 * ja3, 1);

        tx.setRiskScore(finalRisk);
        tx.setBehaviorScore(behaviorScore);
        tx.setGraphScore(graphScore);
        tx.setSuspectedFraud(finalRisk >= 0.45);

        tx.setDecision(
                finalRisk >= 0.75 ? "BLOCK" :
                finalRisk >= 0.45 ? "REVIEW" :
                "APPROVE"
        );
    }
}