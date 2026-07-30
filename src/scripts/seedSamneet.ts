import 'dotenv/config';
import { connectDatabase } from '../config/database';
import { findUserByEmail, findUserByPhoneNumber, createUser } from '../models/User';
import { createDietitian } from '../models/Dietitian';

const run = async () => {
  await connectDatabase();

  const email = 'samneetkaur@gmail.com';
  const phone = '9779881409';

  const existingEmail = await findUserByEmail(email);
  if (existingEmail) { console.log('❌ Email already registered'); process.exit(1); }

  const existingPhone = await findUserByPhoneNumber(phone);
  if (existingPhone) { console.log('❌ Phone already registered'); process.exit(1); }

  const user = await createUser({
    full_name:    'Samneet Kaur',
    email,
    password:     'Samneet@123',
    phone_code:   '+91',
    phone_number: phone,
    role:         'dietitian',
  });
  if (!user) { console.log('❌ Failed to create user'); process.exit(1); }

  const dietitian = await createDietitian({
    user_id:             user.id,
    state:               'Uttar Pradesh',
    city:                'Greater Noida',
    registration_number: null,
    experience:          '10+ years',
    specialization:      [],
    degrees: [
      { degree: 'B.Sc. Nutrition & Dietetics', institute: '', year: null },
    ],
  });
  if (!dietitian) { console.log('❌ Failed to create dietitian profile'); process.exit(1); }

  console.log('✅ Dietitian registered successfully');
  console.log(`   User ID     : ${user.id}`);
  console.log(`   Dietitian ID: ${dietitian.id}`);
  console.log(`   Name        : ${user.full_name}`);
  console.log(`   Email       : ${user.email}`);
  console.log(`   Phone       : ${user.phone_number}`);
  process.exit(0);
};

run().catch((err) => { console.error('❌ Error:', err); process.exit(1); });
