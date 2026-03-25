package com.example.websitedating;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WebsitedatingApplication {

    public static void main(String[] args) {
        SpringApplication.run(WebsitedatingApplication.class, args);
    }

}
