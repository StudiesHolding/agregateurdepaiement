-- Migration: Add metadata column to sl_company_admins table
-- This fixes the "Unknown column 'metadata' in 'field list'" error

ALTER TABLE sl_company_admins 
ADD COLUMN metadata JSON DEFAULT NULL;

-- Verify the column was added
-- DESCRIBE sl_company_admins;
