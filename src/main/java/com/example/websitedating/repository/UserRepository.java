package com.example.websitedating.repository;

import java.util.Optional;

import com.example.websitedating.models.User;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

	boolean existsByEmailIgnoreCase(String email);

	boolean existsByUsernameIgnoreCase(String username);

	boolean existsByClerkId(String clerkId);

	boolean existsByPhone(String phone);

	Optional<User> findByEmailIgnoreCase(String email);

	Optional<User> findByUsernameIgnoreCase(String username);

	Optional<User> findByClerkId(String clerkId);

	Optional<User> findByPhone(String phone);
}


