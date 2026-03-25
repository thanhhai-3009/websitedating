package com.example.websitedating.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public class DateReviewUpsertRequest {

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;

    @Size(max = 500)
    private String comment;

    private List<@Size(max = 40) String> tags;

    private Boolean wouldMeetAgain;

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public Boolean getWouldMeetAgain() {
        return wouldMeetAgain;
    }

    public void setWouldMeetAgain(Boolean wouldMeetAgain) {
        this.wouldMeetAgain = wouldMeetAgain;
    }
}

