package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.model.ModelPerformanceMetrics;
import com.mulehunter.backend.model.NodeEnriched;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.repository.ModelMetricsRepository;
import com.mulehunter.backend.repository.TransactionRepository;
import com.mulehunter.backend.repository.NodeEnrichedRepository;
import com.mulehunter.backend.util.ConfusionMatrix;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Service
public class ModelEvaluationService {

    private final TransactionRepository transactionRepo;
    private final NodeEnrichedRepository nodeRepo;
    private final ModelMetricsRepository metricsRepo;

    public ModelEvaluationService(
            TransactionRepository transactionRepo,
            NodeEnrichedRepository nodeRepo,
            ModelMetricsRepository metricsRepo
    ) {
        this.transactionRepo = transactionRepo;
        this.nodeRepo = nodeRepo;
        this.metricsRepo = metricsRepo;
    }

    public Mono<MetricsResponse> evaluateModels(Instant start, Instant end) {

        double combinedThreshold = 0.45;
        double gnnThreshold = 0.50;
        double eifThreshold = 0.60;

        return transactionRepo.findByTimestampBetween(start, end)

                .flatMap(tx -> {

                    Long srcId, tgtId;
                    try {
                        srcId = Long.parseLong(tx.getSourceAccount());
                        tgtId = Long.parseLong(tx.getTargetAccount());
                    } catch (Exception e) {
                        return Mono.empty(); // skip invalid IDs safely
                    }

                    return nodeRepo.findByNodeId(srcId)
                            .defaultIfEmpty(new NodeEnriched())
                            .zipWith(
                                nodeRepo.findByNodeId(tgtId)
                                        .defaultIfEmpty(new NodeEnriched())
                            )
                            .map(tuple -> {

                                NodeEnriched src = tuple.getT1();
                                NodeEnriched tgt = tuple.getT2();

                                // ⚠️ Replace with real label if available
                                int actual = (
                                        "1".equals(src.getIsFraud()) ||
                                        "1".equals(tgt.getIsFraud())
                                ) ? 1 : 0;

                                return new EvaluationRow(tx, actual);
                            });
                })

                .collectList()

                .flatMap(rows -> {

                    ConfusionMatrix combinedCM = new ConfusionMatrix();
                    ConfusionMatrix gnnCM = new ConfusionMatrix();
                    ConfusionMatrix eifCM = new ConfusionMatrix();

                    for (EvaluationRow r : rows) {

                        int actual = r.actual;

                        int combinedPred = (r.tx.getRiskScore() != null &&
                                r.tx.getRiskScore() >= combinedThreshold) ? 1 : 0;

                        int gnnPred = (r.tx.getGnnScore() != null &&
                                r.tx.getGnnScore() >= gnnThreshold) ? 1 : 0;

                        int eifPred = (r.tx.getUnsupervisedScore() != null &&
                                r.tx.getUnsupervisedScore() >= eifThreshold) ? 1 : 0;

                        combinedCM.add(combinedPred, actual);
                        gnnCM.add(gnnPred, actual);
                        eifCM.add(eifPred, actual);
                    }

                    MetricsResponse response = new MetricsResponse();
                    response.combined = buildMetrics(combinedCM);
                    response.gnn = buildMetrics(gnnCM);
                    response.eif = buildMetrics(eifCM);
                  

                    // Save combined model performance
                    ModelPerformanceMetrics metrics = new ModelPerformanceMetrics();
                    metrics.setModelName("MuleHunter");
                    metrics.setModelVersion("v1");
                    metrics.setEvaluationStart(start);
                    metrics.setEvaluationEnd(end);

                    metrics.setPrecision(response.combined.precision);
                    metrics.setRecall(response.combined.recall);
                    metrics.setF1Score(response.combined.f1Score);
                    metrics.setAccuracy(response.combined.accuracy);

                    metrics.setFpr(response.combined.fpr);
                    metrics.setFnr(response.combined.fnr);

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

        // 🔥 Additional fraud-critical metrics
        m.fpr = (fp + tn == 0) ? 0 : (double) fp / (fp + tn);
        m.fnr = (fn + tp == 0) ? 0 : (double) fn / (fn + tp);

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