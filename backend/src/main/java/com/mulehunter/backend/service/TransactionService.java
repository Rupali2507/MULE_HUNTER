package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;

import reactor.core.publisher.Mono;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;

    public TransactionService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {
        Transaction transaction = Transaction.from(request);
        return transactionRepository.save(transaction);
    }
}
