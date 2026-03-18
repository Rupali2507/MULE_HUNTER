package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.model.ModelPerformanceMetrics;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.Node;
import com.mulehunter.backend.repository.ModelMetricsRepository;
import com.mulehunter.backend.repository.TransactionRepository;
import com.mulehunter.backend.repository.NodeRepository;
import com.mulehunter.backend.util.ConfusionMatrix;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Service
public class ModelEvaluationService {

    private final TransactionRepository transactionRepo;
    private final NodeRepository nodeRepo;
    private final ModelMetricsRepository metricsRepo;

    public ModelEvaluationService(
            TransactionRepository transactionRepo,
            NodeRepository nodeRepo,
            ModelMetricsRepository metricsRepo
    ) {
        this.transactionRepo = transactionRepo;
        this.nodeRepo = nodeRepo;
        this.metricsRepo = metricsRepo;
    }

    public Mono<MetricsResponse> evaluateModels(Instant start, Instant end) {

        return transactionRepo.findByTimestampBetween(start, end)

                // 🔥 JOIN with NODE LABELS (GROUND TRUTH)
                .flatMap(tx ->
                        nodeRepo.findByNodeId(tx.getSourceAccount())
                                .zipWith(nodeRepo.findByNodeId(tx.getTargetAccount()))
                                .map(tuple -> {

                                    Node src = tuple.getT1();
                                    Node tgt = tuple.getT2();

                                    // ✅ ACTUAL LABEL FROM NODE DATA
                                    int actual = (
                                            "1".equals(src.getIsFraud()) ||
                                            "1".equals(tgt.getIsFraud())
                                    ) ? 1 : 0;

                                    return new EvaluationRow(tx, actual);
                                })
                )

                .collectList()

                .flatMap(rows -> {

                    ConfusionMatrix combinedCM = new ConfusionMatrix();
                    ConfusionMatrix gnnCM = new ConfusionMatrix();
                    ConfusionMatrix eifCM = new ConfusionMatrix();

                    for (EvaluationRow r : rows) {

                        int actual = r.actual;

                        // 🔥 PREDICTIONS
                        int combinedPred = (r.tx.getRiskScore() != null &&
                                r.tx.getRiskScore() >= 0.45) ? 1 : 0;

                        int gnnPred = (r.tx.getGnnScore() != null &&
                                r.tx.getGnnScore() >= 0.45) ? 1 : 0;

                        int eifPred = (r.tx.getUnsupervisedScore() != null &&
                                r.tx.getUnsupervisedScore() >= 0.45) ? 1 : 0;

                        combinedCM.add(combinedPred, actual);
                        gnnCM.add(gnnPred, actual);
                        eifCM.add(eifPred, actual);
                    }

                    // ── BUILD RESPONSE ─────────────────────
                    MetricsResponse response = new MetricsResponse();
                    response.combined = buildMetrics(combinedCM);
                    response.gnn = buildMetrics(gnnCM);
                    response.eif = buildMetrics(eifCM);

                    // ── STORE COMBINED METRICS ─────────────
                    ModelPerformanceMetrics metrics = new ModelPerformanceMetrics();
                    metrics.setModelName("MuleHunter");
                    metrics.setModelVersion("v1");
                    metrics.setEvaluationStart(start);
                    metrics.setEvaluationEnd(end);

                    metrics.setPrecision(response.combined.precision);
                    metrics.setRecall(response.combined.recall);
                    metrics.setF1Score(response.combined.f1Score);
                    metrics.setAccuracy(response.combined.accuracy);

                    metrics.setTp((int) combinedCM.getTp());
                    metrics.setFp((int) combinedCM.getFp());
                    metrics.setTn((int) combinedCM.getTn());
                    metrics.setFn((int) combinedCM.getFn());

                    metrics.setEvaluatedAt(Instant.now());

                    return metricsRepo.save(metrics)
                            .thenReturn(response);
                });
    }

    // ─────────────────────────────────────
    // METRIC CALCULATOR
    // ─────────────────────────────────────
    private MetricsResponse.ModelMetrics buildMetrics(ConfusionMatrix cm) {

        MetricsResponse.ModelMetrics m = new MetricsResponse.ModelMetrics();

        long tp = cm.getTp();
        long fp = cm.getFp();
        long tn = cm.getTn();
        long fn = cm.getFn();

        m.precision = (tp + fp == 0) ? 0 : (double) tp / (tp + fp);
        m.recall = (tp + fn == 0) ? 0 : (double) tp / (tp + fn);
        m.f1Score = (m.precision + m.recall == 0) ? 0 :
                2 * m.precision * m.recall / (m.precision + m.recall);
        m.accuracy = (tp + tn + fp + fn == 0) ? 0 :
                (double) (tp + tn) / (tp + tn + fp + fn);

        return m;
    }

    // ─────────────────────────────────────
    // HELPER CLASS
    // ─────────────────────────────────────
    static class EvaluationRow {
        Transaction tx;
        int actual;

        EvaluationRow(Transaction tx, int actual) {
            this.tx = tx;
            this.actual = actual;
        }
    }
}