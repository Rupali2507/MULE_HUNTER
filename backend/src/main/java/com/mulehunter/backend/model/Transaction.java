package com.mulehunter.backend.model;

import java.math.BigDecimal;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "transactions")
public class Transaction {

    @Id
    private String id;

    private String accountId;
    private BigDecimal amount;
    private String merchant;
    private boolean suspectedFraud;

    public Transaction() {}

    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.accountId = request.getAccountId();
        tx.amount = request.getAmount();
        tx.merchant = request.getMerchant();
        tx.suspectedFraud = false; //default, model decides
        return tx;
    }

    public String getId() {
        return id;
    }

    public String getAccountId() {
        return accountId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getMerchant() {
        return merchant;
    }

    public boolean isSuspectedFraud() {
        return suspectedFraud;
    }

    public void setSuspectedFraud(boolean suspectedFraud) {
        this.suspectedFraud = suspectedFraud;
    }
}
