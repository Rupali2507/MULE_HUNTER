package com.mulehunter.backend.model;

import java.math.BigDecimal;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Document(collection = "transactions")
public class Transaction {

    @Id
    private String id;

    private String sourceAccount;
    private String targetAccount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;
    
    private boolean suspectedFraud;

    public Transaction() {}

    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.sourceAccount = request.getSourceAccount();
        tx.targetAccount = request.getTargetAccount();
        tx.amount = request.getAmount();
        tx.suspectedFraud = false;
        return tx;
    }

    public String getId() {
        return id;
    }

    public String getSourceAccount() {
        return sourceAccount;
    }

    public String getTargetAccount() {
        return targetAccount;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public boolean isSuspectedFraud() {
        return suspectedFraud;
    }

    public void setSuspectedFraud(boolean suspectedFraud) {
        this.suspectedFraud = suspectedFraud;
    }
}
