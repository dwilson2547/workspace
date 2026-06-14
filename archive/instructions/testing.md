# Testing Agent Instructions

Tests should cover all major functionality within a project.
Tests should be written to test specific functionality, line coverage doesn't really matter.
Test cases should be driven by the requirements and account for edge cases.
When testing apis or other services that connect to a database, use testcontainers for more thorough integration testing.
Unit tests and Integration tests are separate and they are not substitutes for each-other.
When a web based ui is present, use playwright to test it.
