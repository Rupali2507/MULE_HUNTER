package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import reactor.core.publisher.Mono;
import java.util.Map;

/**
 * Service responsible for processing financial transactions.
 * It orchestrates the flow between the Database, Node Analytics, and the AI Fraud Engine.
 */
@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;
    private final WebClient webClient; 

    public TransactionService(TransactionRepository repository, NodeEnrichedService nodeEnrichedService) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        
        // Initialize connection to the AI Engine
        this.webClient = WebClient.builder()
                .baseUrl("http://host.docker.internal:8000")
                .build();
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {
        Transaction tx = Transaction.from(request);
        Long sourceNodeId = Long.parseLong(tx.getSourceAccount());
        Long targetNodeId = Long.parseLong(tx.getTargetAccount());
        double amount = tx.getAmount().doubleValue();

        // 1. Save Initial "Ground Truth"
        return repository.save(tx)
                .flatMap(savedTx -> 
                    // 2. Update Graph Analytics
                    Mono.when(
                        nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                        nodeEnrichedService.handleIncoming(targetNodeId, amount)
                    )
                    // 3. Call AI Model
                    .then(callAiModel(sourceNodeId, targetNodeId, amount))
                    .flatMap(aiResponse -> {
                        // 4. Process AI Verdict
                        if (aiResponse != null && aiResponse.has("risk_score")) {
                            double riskScore = aiResponse.get("risk_score").asDouble();
                            String verdict = aiResponse.get("verdict").asText();
                            
                            System.out.println("🤖 AI ORCHESTRATOR :: Transaction ID " + savedTx.getId() + 
                                             " | Risk Score: " + riskScore + " | Verdict: " + verdict);
                            
                            //Save the Score and Verdict to the Database object
                            savedTx.setRiskScore(riskScore);
                            savedTx.setVerdict(verdict);

                            // Flag as fraud if score is high
                            if (riskScore > 0.5) {
                                savedTx.setSuspectedFraud(true);
                            } else {
                                savedTx.setSuspectedFraud(false);
                            }

                            // Save the updated object back to the DB
                            return repository.save(savedTx);
                        }
                        return Mono.just(savedTx);
                    })
                );
    }

    private Mono<JsonNode> callAiModel(Long source, Long target, double amount) {
        Map<String, Object> aiPayload = Map.of(
            "source_id", source,
            "target_id", target,
            "amount", amount,
            "timestamp", "2025-12-25"
        );

        return webClient.post()
                .uri("/analyze-transaction")
                .bodyValue(aiPayload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorResume(e -> {
                    System.err.println("AI SERVICE CONNECTION FAILED: " + e.getMessage());
                    return Mono.empty(); 
                });
    }
}