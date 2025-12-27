package com.mulehunter.backend.controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.mulehunter.backend.model.AnomalyScore;
import com.mulehunter.backend.repository.AnomalyScoreRepository;
import com.mulehunter.backend.DTO.AnomalyScoreDTO;
import com.mulehunter.backend.service.AnomalyScoreService;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api") 
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true") 
public class AnomalyScoreController {

    private final AnomalyScoreService service;
    private final AnomalyScoreRepository repository;

    public AnomalyScoreController(AnomalyScoreService service, AnomalyScoreRepository repository) {
        this.service = service;
        this.repository = repository;
    }


    @PostMapping("/visual/anomaly-scores/batch")
    public Mono<String> saveBatch(@RequestBody List<AnomalyScoreDTO> payload) {
        return service.saveBatch(Flux.fromIterable(payload))
                .thenReturn("Anomaly scores stored successfully");
    }


    @GetMapping("/risk-scores/{nodeId}")
    public Mono<AnomalyScore> getLatest(@PathVariable Long nodeId) {
        return repository.findByNodeId(nodeId);
    }
}