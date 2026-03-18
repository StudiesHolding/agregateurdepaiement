/**
 * Script to revert request 1 back to Package ID 3
 */
import { sequelize, AccessRequest } from '../models/index.js';

async function revertRequest() {
    const transaction = await sequelize.transaction();

    try {
        await sequelize.authenticate();
        console.log('Connected to database\n');

        const request = await AccessRequest.findByPk(1);
        console.log(`Current request:`);
        console.log(`  ID: ${request.id}`);
        console.log(`  Company Package ID: ${request.company_package_id}`);
        console.log(`  Status: ${request.status}`);

        // Revert to Package ID 3
        console.log(`\n>>> Reverting request to Package ID 3`);

        await request.update({
            company_package_id: 3
        }, { transaction });

        await transaction.commit();
        console.log('\n✓ Request reverted successfully!');

        process.exit(0);
    } catch (error) {
        await transaction.rollback();
        console.error('Error:', error.message);
        process.exit(1);
    }
}

revertRequest();
