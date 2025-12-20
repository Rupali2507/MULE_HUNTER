// package com.mulehunter.backend.controller;

// import java.time.Duration;

// import org.springframework.web.bind.annotation.GetMapping;
// import org.springframework.web.bind.annotation.RestController;

// import reactor.core.publisher.Mono;

// @RestController
// public class MuleController {

//     @GetMapping("/ping")
//     public String ping() {
//         System.out.println("Thread: " + Thread.currentThread().getName());
//         return "pong";
//     }

//     @GetMapping("/mvc-wait")
//     public String mvcWait() throws InterruptedException {
//         System.out.println("MVC before sleep: " + Thread.currentThread().getName());
//         Thread.sleep(2000);
//         System.out.println("MVC after sleep: " + Thread.currentThread().getName());
//         return "done";
//     }

//     @GetMapping("/flux-wait")
// public Mono<String> fluxWait() {
//     System.out.println("Flux before delay: " + Thread.currentThread().getName());
//     return Mono.delay(Duration.ofSeconds(2))
//             .map(t -> {
//                 System.out.println("Flux after delay: " + Thread.currentThread().getName());
//                 return "done";
//             });
// }

// }

