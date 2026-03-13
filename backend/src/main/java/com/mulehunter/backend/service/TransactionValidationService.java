package com.mulehunter.backend.service;

import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.Duration;

@Service
public class TransactionValidationService {

    private final TransactionRepository repository;

    public TransactionValidationService(TransactionRepository repository) {
        this.repository = repository;
    }

    public Mono<Void> validate(TransactionRequest request) {

        // 1️⃣ Required fields check
        if (request.getSourceAccount() == null ||
            request.getTargetAccount() == null ||
            request.getAmount() == null ||
            request.getTransactionId() == null ||
            request.getTimestamp() == null) {

            return Mono.error(new IllegalArgumentException("Missing required fields"));
        }

        // 2️⃣ Amount validation
        if (request.getAmount().doubleValue() <= 0) {
            return Mono.error(new IllegalArgumentException("Amount must be > 0"));
        }

        // 3️⃣ Timestamp validation (24h window)
        Instant ts = request.getTimestamp();
        Instant now = Instant.now();
        Instant cutoff = now.minus(Duration.ofHours(24));

        if (ts.isBefore(cutoff)) {
            return Mono.error(new IllegalArgumentException("Transaction timestamp too old"));
        }

        // 4️⃣ Duplicate transactionId check
        return repository.existsByTransactionId(request.getTransactionId())
                .flatMap(exists -> {
                    if (exists) {
                        return Mono.error(new IllegalArgumentException("Duplicate transactionId"));
                    }
                    return Mono.empty();
                });
    }
}