package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.DTO.IdentityFeaturesDTO;
import com.mulehunter.backend.model.AiRiskResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Map;

@Service
public class AiRiskService {

    private final WebClient aiWebClient;

    public AiRiskService(
            @Value("${ai.service.url:http://56.228.10.113:8001}") String aiServiceUrl
    ) {

        System.out.println("🔌 CONNECTING AI TO: " + aiServiceUrl);

        this.aiWebClient = WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();
    }

    /**
     * Calls MuleHunter AI service to compute GNN + EIF scores
     */
    public Mono<AiRiskResult> analyzeTransaction(
            Long source,
            Long target,
            double amount,
            BehaviorFeaturesDTO behavior,
            GraphFeaturesDTO graph,
            IdentityFeaturesDTO identity
    ) {

        // Graph signals
        Map<String, Object> graphFeatures = Map.of(
                "suspiciousNeighborCount", graph.getSuspiciousNeighborCount(),
                "twoHopFraudDensity", graph.getTwoHopFraudDensity(),
                "connectivityScore", graph.getConnectivityScore()
        );

        // Behavior signals
        Map<String, Object> behaviorFeatures = Map.of(
                "velocity", behavior.getTransactionVelocityScore(),
                "burst", behavior.getBurstScore()
        );

        // Identity signals
        Map<String, Object> identityFeatures = Map.of(
                "deviceReuse", identity.getDeviceReuseCount(),
                "ja3Reuse", identity.getJa3ReuseCount(),
                "ipReuse", identity.getIpReuseCount()
        );

        // Full payload sent to AI service
        Map<String, Object> payload = Map.of(
                "accountId", String.valueOf(source),
                "graphFeatures", graphFeatures,
                "behaviorFeatures", behaviorFeatures,
                "identityFeatures", identityFeatures
        );

        return aiWebClient.post()
                .uri("/v1/gnn/score")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(5))
                .map(this::mapAiResponse)
                .onErrorResume(e -> {

                    System.err.println("⚠️ AI SERVICE ERROR: " + e.getMessage());

                    // Fail-safe fallback
                    return Mono.just(new AiRiskResult());
                });
    }

    /**
     * Convert AI response → AiRiskResult
     */
    private AiRiskResult mapAiResponse(JsonNode res) {

        if (res == null || !res.has("gnnScore")) {
            return new AiRiskResult();
        }

        double gnnScore = res.path("gnnScore").asDouble(0.0);
        double eifScore = res.path("eifScore").asDouble(0.0);
        double confidence = res.path("confidence").asDouble(0.0);
        int clusterId = res.path("fraudClusterId").asInt(0);

        AiRiskResult result = new AiRiskResult();

        result.setRiskScore(gnnScore);
        result.setUnsupervisedScore(eifScore);
        result.setSuspectedFraud(gnnScore > 0.5);
        result.setModelVersion(res.path("version").asText("GNN-v2"));
        result.setVerdict("AI_ANALYZED");
        result.setLinkedAccounts(new ArrayList<>());

        System.out.println(
                "🤖 AI RESULT → "
                        + "gnn=" + String.format("%.4f", gnnScore)
                        + " eif=" + String.format("%.4f", eifScore)
                        + " conf=" + String.format("%.4f", confidence)
                        + " cluster=" + clusterId
        );

        return result;
    }
}