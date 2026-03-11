package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.repository.TransactionRepository;

import reactor.core.publisher.Mono;

@Service
public class IdentityCollectorService {

    private final TransactionRepository repository;

    public IdentityCollectorService(TransactionRepository repository) {
        this.repository = repository;
    }

    public Mono<Transaction> collect(Transaction tx, String ja3, String deviceHash, String ip) {

        tx.setDeviceHash(deviceHash);
        tx.setIpAddress(ip);

        Mono<Long> ja3Count =
                repository.countByJa3Detected(true).defaultIfEmpty(0L);

        Mono<Long> deviceCount;
        deviceCount = repository.countByDeviceHash(deviceHash).defaultIfEmpty(0L);

        Mono<Long> ipCount =
                repository.countByIpAddress(ip).defaultIfEmpty(0L);

        return Mono.zip(ja3Count, deviceCount, ipCount)
                .map(tuple -> {

                    int ja3Reuse = tuple.getT1().intValue();
                    int deviceReuse = tuple.getT2().intValue();
                    int ipReuse = tuple.getT3().intValue();

                    tx.setJa3ReuseCount(ja3Reuse);
                    tx.setDeviceReuseCount(deviceReuse);
                    tx.setIpReuseCount(ipReuse);

                    tx.setIsNewDevice(deviceReuse == 0);
                    tx.setIsNewJa3(ja3Reuse == 0);

                    return tx;
                });
    }
}
