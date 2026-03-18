/**
 * Script to debug license counts in the database
 */
import { sequelize, CompanyPackage, AccessRequest, Employee } from '../models/index.js';

async function debugLicenses() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database\n');

        // Get all company packages with license info
        const packages = await CompanyPackage.findAll();

        console.log('=== Company Packages ===');
        for (const pkg of packages) {
            console.log(`\nPackage ID: ${pkg.id}`);
            console.log(`  Company ID: ${pkg.company_id}`);
            console.log(`  Total Licenses: ${pkg.total_licenses}`);
            console.log(`  Used Licenses: ${pkg.used_licenses}`);
            console.log(`  Status: ${pkg.status}`);
            console.log(`  Available: ${pkg.total_licenses - pkg.used_licenses}`);
        }

        // Get all access requests
        const requests = await AccessRequest.findAll({
            include: [
                { model: Employee, as: 'employee' }
            ]
        });

        console.log('\n=== Access Requests ===');
        for (const req of requests) {
            console.log(`\nRequest ID: ${req.id}`);
            console.log(`  Employee: ${req.employee?.first_name} ${req.employee?.last_name} (${req.employee?.email})`);
            console.log(`  Company Package ID: ${req.company_package_id}`);
            console.log(`  Status: ${req.status}`);
            console.log(`  Created: ${req.created_at}`);
        }

        console.log('\n=== Done ===');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

debugLicenses();
