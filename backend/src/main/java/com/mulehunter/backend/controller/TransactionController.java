package com.mulehunter.backend.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.service.TransactionService;

import reactor.core.publisher.Mono;

@RestController
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/transactions")
    public Mono<Transaction> createTransaction(@RequestBody TransactionRequest request) {
        return transactionService.createTransaction(request);
    }
}
