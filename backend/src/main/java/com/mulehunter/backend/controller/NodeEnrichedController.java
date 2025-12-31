package com.mulehunter.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.model.NodeEnriched;
import com.mulehunter.backend.repository.NodeEnrichedRepository;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("")
public class NodeEnrichedController {/backend/api/nodes/enriched

    private final NodeEnrichedRepository repository;

    public NodeEnrichedController(NodeEnrichedRepository repository) {
        this.repository = repository;
    }

    // ML + debug
    @GetMapping
    public Flux<NodeEnriched> getAll() {
        return repository.findAll();
    }

    // UI / debug
    @GetMapping("/{nodeId}")
    public Mono<NodeEnriched> getOne(@PathVariable Long nodeId) {
        return repository.findByNodeId(nodeId);
    }
}
