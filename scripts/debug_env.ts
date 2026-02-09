
import * as dotenv from 'dotenv';
import path from 'path';

console.log('Current directory:', process.cwd());
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env.local:', result.error);
}

console.log('DATABASE_URL starts with:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 10) : 'UNDEFINED');
