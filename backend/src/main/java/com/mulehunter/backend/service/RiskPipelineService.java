package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.RiskDecisionDTO;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import java.util.*;

/**
 * Thin orchestration layer over TransactionService.
 * All 7 pipeline steps already run inside TransactionService.
 * This just converts the final Transaction into a RiskDecisionDTO.
 * 
 */
@Service
public class RiskPipelineService {

    private final TransactionService transactionService;
    private final FraudSignalService fraudSignalService;
    public RiskPipelineService(TransactionService transactionService,FraudSignalService fraudSignalService) {
        this.transactionService = transactionService;
        this.fraudSignalService = fraudSignalService;
    }

    public Mono<RiskDecisionDTO> evaluate(TransactionRequest request, String ja3) {
        return transactionService.createTransaction(request, ja3)
                .map(this::toDecision);
    }

    private Map<String, Double> parseFactors(String factors) {

    if (factors == null || factors.isEmpty()) {
        return Map.of();
    }

    Map<String, Double> result = new HashMap<>();

    factors = factors.replace("{", "").replace("}", "");

    String[] pairs = factors.split(",");

    for (String p : pairs) {
        String[] kv = p.split("=");

        if (kv.length == 2) {
            try {
                result.put(kv[0].trim(), Double.parseDouble(kv[1].trim()));
            } catch (Exception ignored) {}
        }
    }

    return result;
}


   private RiskDecisionDTO toDecision(Transaction tx) {

        double score = tx.getRiskScore() == null ? 0.0 : tx.getRiskScore();

        String decision;
        if (score >= 0.75)      decision = "BLOCK";
        else if (score >= 0.45) decision = "REVIEW";
        else                    decision = "APPROVE";

        Map<String, Double> components = Map.of(
            "gnn", tx.getGnnScore() == null ? 0.0 : tx.getGnnScore(),
            "eif", tx.getUnsupervisedScore() == null ? 0.0 : tx.getUnsupervisedScore(),
            "behavior", tx.getBehaviorScore() == null ? 0.0 : tx.getBehaviorScore(),
            "velocity", tx.getVelocityScore() == null ? 0.0 : tx.getVelocityScore(),
            "burst", tx.getBurstScore() == null ? 0.0 : tx.getBurstScore(),
            "ja3", tx.getJa3Risk() == null ? 0.0 : tx.getJa3Risk()
        );
         Map<String, Double> factors = parseFactors(tx.getEifTopFactors());
        List<String> signals = fraudSignalService.deriveSignals(factors);

        return RiskDecisionDTO.builder()
            .transactionId(tx.getTransactionId())
            .decision(decision)
            .riskScore(score)
            .explanation(buildExplanation(tx, score))
            .highConfidence(tx.isSuspectedFraud())
            .components(components)

            .eifTopFactors(factors)          // ADD THIS
            .fraudSignals(signals)
            .eifExplanation(tx.getEifExplanation())

            .build();
    }

    private String buildExplanation(Transaction tx, double score) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Combined risk: %.2f. ", score));

        if (tx.getJa3Risk() != null && tx.getJa3Risk() > 0.7)
            sb.append("High JA3 risk. ");
        if (tx.getRiskRatio() != null && tx.getRiskRatio() > 0.9)
            sb.append("Suspicious outflow/inflow ratio. ");
        if (tx.getOutDegree() > 20)
            sb.append("High fan-out (mule pattern). ");
        if (tx.getLinkedAccounts() != null && tx.getLinkedAccounts().size() > 10)
            sb.append("Many linked accounts. ");
        if (Boolean.TRUE.equals(tx.getIsNewDevice()))
            sb.append("New device. ");
        if (tx.getJa3ReuseCount() != null && tx.getJa3ReuseCount() > 5)
            sb.append("JA3 reused across accounts. ");

        return sb.toString().trim();
    }
}