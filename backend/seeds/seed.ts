import { getPool } from '../src/config/database';
import { hashPassword, generateWaybillNumber, generateBookingRef, generateQRCode, generateBarcode } from '../src/utils/auth';

async function seed(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding database...');

    // Create demo users
    console.log('Creating demo users...');

    const adminPassword = await hashPassword('password');
    const agentPassword = await hashPassword('password');
    const operatorPassword = await hashPassword('password');
    const customerPassword = await hashPassword('password');

    // Insert users
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, region, is_active)
       VALUES 
       ($1, $2, 'Admin', 'User', 'admin', 'HQ', true),
       ($3, $4, 'Agent Manila', 'User', 'agent', 'NCR', true),
       ($5, $6, 'Agent Cebu', 'User', 'agent', 'Region VII', true),
       ($7, $8, 'Operator', 'User', 'operator', 'NCR', true),
       ($9, $10, 'Customer', 'User', 'customer', null, true),
       ($11, $12, 'Auditor', 'User', 'auditor', null, true)`,
      [
        'admin@toplis.com', adminPassword,
        'agent.manila@toplis.com', agentPassword,
        'agent.cebu@toplis.com', agentPassword,
        'operator@toplis.com', operatorPassword,
        'customer@toplis.com', customerPassword,
        'auditor@toplis.com', adminPassword,
      ]
    );

    console.log('✓ Users created');

    // Create agents
    console.log('Creating agents...');

    const agentUsers = await client.query(
      `SELECT id FROM users WHERE role = 'agent'`
    );

    for (const agent of agentUsers.rows) {
      await client.query(
        `INSERT INTO agents (user_id, region, assigned_modes, is_active)
         VALUES ($1, $2, $3, true)`,
        [
          agent.id,
          agent.region === 'NCR' ? 'NCR' : 'Region VII',
          ['sea', 'air', 'land']
        ]
      );
    }

    console.log('✓ Agents created');

    // Create sample shipments
    console.log('Creating sample shipments...');

    const operatorUser = await client.query(
      `SELECT id FROM users WHERE email = 'operator@toplis.com'`
    );

    const manilaAgent = await client.query(
      `SELECT id FROM agents WHERE user_id IN (SELECT id FROM users WHERE email = 'agent.manila@toplis.com')`
    );

    const shipmentModes = ['sea', 'air', 'land'];
    const shipmentStatuses = ['created', 'picked_up', 'at_depot', 'loaded', 'delivered'];

    for (let i = 0; i < 5; i++) {
      const bookingRef = generateBookingRef();
      const waybillNumber = generateWaybillNumber();
      const mode = shipmentModes[Math.floor(Math.random() * shipmentModes.length)];
      const status = shipmentStatuses[Math.floor(Math.random() * shipmentStatuses.length)];
      const totalPieces = Math.floor(Math.random() * 50) + 1;
      const estimatedArrival = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);

      const { rows: shipments } = await client.query(
        `INSERT INTO shipments (
          booking_ref, waybill_number, shipper_name, shipper_address,
          consignee_name, consignee_address, origin_city, origin_country,
          destination_city, destination_country, mode, total_pieces,
          total_weight, commodity_description, assigned_agent_id,
          current_status, estimated_arrival, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id`,
        [
          bookingRef,
          waybillNumber,
          `Shipper Corp ${i}`,
          `${100 + i} Business St, Manila`,
          `Consignee Inc ${i}`,
          `${200 + i} Trade Ave, Cebu`,
          'Manila',
          'PH',
          'Cebu',
          'PH',
          mode,
          totalPieces,
          Math.random() * 5000,
          'Mixed cargo',
          manilaAgent.rows[0]?.id || null,
          status,
          estimatedArrival,
          operatorUser.rows[0].id,
        ]
      );

      const shipmentId = shipments[0].id;

      // Create packages for this shipment
      for (let j = 1; j <= totalPieces; j++) {
        const qrCode = generateQRCode(shipmentId, j);
        const barcode = generateBarcode();

        await client.query(
          `INSERT INTO packages (shipment_id, barcode, qr_code, piece_number, weight, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [shipmentId, barcode, qrCode, j, Math.random() * 100, status]
        );
      }

      console.log(`✓ Created shipment ${bookingRef} with ${totalPieces} packages`);
    }

    console.log('✓ Sample shipments created');

    console.log('\n✅ Database seeding completed!');
    console.log('\nDemo Credentials:');
    console.log('  Admin: admin@toplis.com / password');
    console.log('  Agent (Manila): agent.manila@toplis.com / password');
    console.log('  Agent (Cebu): agent.cebu@toplis.com / password');
    console.log('  Operator: operator@toplis.com / password');
    console.log('  Customer: customer@toplis.com / password');
    console.log('  Auditor: auditor@toplis.com / password');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
