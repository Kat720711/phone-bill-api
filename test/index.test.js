import request from 'supertest';
import express from 'express';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import { setupApp } from '../index.js'; 

let app;
let db;

beforeAll(async () => {
    app = await setupApp();
    db = await sqlite.open({
        filename: './data_plan.db',
        driver: sqlite3.Database
    });
    await db.migrate();
});

beforeEach(async () => {
    await db.exec('DELETE FROM price_plan');
    await db.run('INSERT INTO price_plan (plan_name, sms_price, call_price) VALUES (?, ?, ?)', 'sms_kick_100', 0.45, 2.65);
    await db.run('INSERT INTO price_plan (plan_name, sms_price, call_price) VALUES (?, ?, ?)', 'call_kick_200', 0.50, 2.75);
});

describe('API Endpoints', () => {
    test('POST /api/phonebill/ should calculate total correctly', async () => {
        const response = await request(app)
            .post('/api/phonebill/')
            .send({ price_plan: 'sms_kick_100', actions: 'call, sms, call' });

        expect(response.status).toBe(200);
        expect(response.body.total).toBeCloseTo(2.65 * 2 + 0.45, 2); 
    });

    test('GET /api/price_plans/ should return all price plans', async () => {
        const response = await request(app).get('/api/price_plans/');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2); 
        expect(response.body[0]).toHaveProperty('plan_name', 'sms_kick_100');
        expect(response.body[1]).toHaveProperty('plan_name', 'call_kick_200');
    });

    test('POST /api/price_plan/create should create a new price plan', async () => {
        const response = await request(app)
            .post('/api/price_plan/create')
            .send({ name: 'new_plan_300', call_cost: 3.00, sms_cost: 0.60 });

        expect(response.status).toBe(201);
        const plans = await db.all('SELECT * FROM price_plan WHERE plan_name = ?', 'new_plan_300');
        expect(plans).toHaveLength(1);
        expect(plans[0]).toHaveProperty('plan_name', 'new_plan_300');
        expect(plans[0]).toHaveProperty('call_price', 3.00);
        expect(plans[0]).toHaveProperty('sms_price', 0.60);
    });

    test('POST /api/price_plan/update should update an existing price plan', async () => {
        const response = await request(app)
            .post('/api/price_plan/update')
            .send({ name: 'sms_kick_100', call_cost: 3.00, sms_cost: 0.60 });

        expect(response.status).toBe(200);
        const [plan] = await db.all('SELECT * FROM price_plan WHERE plan_name = ?', 'sms_kick_100');
        expect(plan).toHaveProperty('call_price', 3.00);
        expect(plan).toHaveProperty('sms_price', 0.60);
    });

    test('POST /api/price_plan/delete should delete a price plan', async () => {
        const [plan] = await db.all('SELECT * FROM price_plan WHERE plan_name = ?', 'call_kick_200');
        const response = await request(app)
            .post('/api/price_plan/delete')
            .send({ id: plan.id });

        expect(response.status).toBe(200);
        const plans = await db.all('SELECT * FROM price_plan WHERE plan_name = ?', 'call_kick_200');
        expect(plans).toHaveLength(0);
    });
});

