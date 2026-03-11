package com.mulehunter.backend.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;

import com.mulehunter.backend.model.Transaction;

import reactor.core.publisher.Mono;

public interface TransactionRepository
        extends ReactiveCrudRepository<Transaction, String> {

    Mono<Boolean> existsByTransactionId(String transactionId);
    Mono<Long> countByJa3Detected(Boolean ja3Detected);
    Mono<Long> countByDeviceHash(String deviceHash);
    Mono<Long> countByIpAddress(String ipAddress);
}