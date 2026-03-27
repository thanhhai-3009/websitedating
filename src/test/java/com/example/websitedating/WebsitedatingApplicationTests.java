package com.example.websitedating;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mail.javamail.JavaMailSender;

@SpringBootTest
class WebsitedatingApplicationTests {

    @MockBean
    private JavaMailSender mailSender;

    @Test
    void contextLoads() {
    }

}
