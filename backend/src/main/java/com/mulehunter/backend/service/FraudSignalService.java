package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class FraudSignalService {

    public List<String> deriveSignals(Map<String, Double> shapFactors) {

        if (shapFactors == null) return List.of();

        List<String> signals = new ArrayList<>();

        if (shapFactors.containsKey("device_reuse_count"))
            signals.add("DEVICE_REUSE_ACROSS_ACCOUNTS");

        if (shapFactors.containsKey("suspicious_neighbor_count"))
            signals.add("SUSPICIOUS_NETWORK_CONNECTION");

        if (shapFactors.containsKey("ja3_reuse_count"))
            signals.add("TLS_FINGERPRINT_REUSE");

        if (shapFactors.containsKey("velocity_score"))
            signals.add("HIGH_TRANSACTION_VELOCITY");

        if (shapFactors.containsKey("burst_score"))
            signals.add("BURST_TRANSACTION_PATTERN");

        return signals;
    }
}