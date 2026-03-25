package com.example.websitedating.services;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.websitedating.constants.CommonEnums.ReportCategory;
import com.example.websitedating.models.Report;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.BlockRepository;
import com.example.websitedating.repository.ConnectionRepository;
import com.example.websitedating.repository.ReportRepository;
import com.example.websitedating.repository.UserRepository;
import java.util.Optional;
import java.util.ArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class ModerationServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private BlockRepository blockRepository;
    @Mock
    private ReportRepository reportRepository;
    @Mock
    private ConnectionRepository connectionRepository;

    @InjectMocks
    private ModerationService moderationService;

    private User me;
    private User target;

    @BeforeEach
    void setUp() {
        me = new User();
        me.setId("me-id");
        me.setClerkId("me-clerk");

        target = new User();
        target.setId("target-id");
        target.setClerkId("target-clerk");
    }

    @Test
    void testBlockUser_Success() {
        when(userRepository.findByClerkId("me-clerk")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(blockRepository.existsByBlockerIdAndBlockedUserId("me-id", "target-id")).thenReturn(false);
        when(connectionRepository.findBySenderIdOrReceiverId("me-id", "target-id")).thenReturn(new ArrayList<>());

        moderationService.blockUser("me-clerk", "target-id", "Testing");

        verify(blockRepository).save(any());
        verify(connectionRepository).findBySenderIdOrReceiverId("me-id", "target-id");
    }

    @Test
    void testReportUser_Urgent_AutoBlocks() {
        when(userRepository.findByClerkId("me-clerk")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(blockRepository.existsByBlockerIdAndBlockedUserId("me-id", "target-id")).thenReturn(false);
        when(connectionRepository.findBySenderIdOrReceiverId("me-id", "target-id")).thenReturn(new ArrayList<>());
        
        moderationService.reportUser("me-clerk", "target-id", ReportCategory.harassment, "Bad", null);
        
        verify(reportRepository).save(any(Report.class));
        verify(blockRepository).save(any()); // Auto-block triggered for harassment
    }

    @Test
    void testBanUser() {
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(userRepository.save(any())).thenReturn(target);

        moderationService.banUser("target-id", "Spam");

        assertTrue(target.getIsBanned());
        assertEquals("Spam", target.getBanReason());
        assertNotNull(target.getBannedAt());
    }
}
