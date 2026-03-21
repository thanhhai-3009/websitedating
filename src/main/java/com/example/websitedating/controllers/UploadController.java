package com.example.websitedating.controllers;

import com.example.websitedating.services.PhotoUploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final PhotoUploadService photoUploadService;

    public UploadController(PhotoUploadService photoUploadService) {
        this.photoUploadService = photoUploadService;
    }

    @PostMapping(value = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.OK)
    public UploadPhotoResponse uploadPhoto(@RequestPart("file") MultipartFile file) {
        String url = photoUploadService.uploadPhoto(file);
        return new UploadPhotoResponse(url);
    }

    public record UploadPhotoResponse(String url) {
    }
}
