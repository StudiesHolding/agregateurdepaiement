/**
 * Script to fix the license issue for request ID 1
 * The issue: Request 1 is linked to Package 3 which has 0 available licenses
 * Solution: Change the request to use Package 6 which has 1 available license
 */
import { sequelize, AccessRequest, CompanyPackage } from '../models/index.js';

async function fixLicenseIssue() {
    const transaction = await sequelize.transaction();

    try {
        await sequelize.authenticate();
        console.log('Connected to database\n');

        // Get the request
        const request = await AccessRequest.findByPk(1);
        console.log(`Current request:`);
        console.log(`  ID: ${request.id}`);
        console.log(`  Company Package ID: ${request.company_package_id}`);
        console.log(`  Status: ${request.status}`);

        // Get available packages for this company
        const packages = await CompanyPackage.findAll({
            where: { company_id: request.company_id }
        });

        console.log(`\nPackages for company ${request.company_id}:`);
        for (const pkg of packages) {
            console.log(`  Package ${pkg.id}: ${pkg.total_licenses - pkg.used_licenses} available (${pkg.used_licenses}/${pkg.total_licenses})`);
        }

        // Find a package with available licenses
        const availablePackage = packages.find(p => (p.total_licenses - p.used_licenses) > 0);

        if (availablePackage) {
            console.log(`\n>>> Changing request package from ${request.company_package_id} to ${availablePackage.id}`);

            await request.update({
                company_package_id: availablePackage.id
            }, { transaction });

            await transaction.commit();
            console.log('\n✓ Request updated successfully!');
            console.log(`  Request now uses Package ${availablePackage.id} which has ${availablePackage.total_licenses - availablePackage.used_licenses} available licenses`);
        } else {
            console.log('\n✗ No packages with available licenses found!');
        }

        process.exit(0);
    } catch (error) {
        await transaction.rollback();
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fixLicenseIssue();
