import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema, serverSchema, alertSchema, parse } from '../src/services/validation.js';

test('registration accepts valid user input', () => {
  const result = parse(registerSchema, { name: 'Safi User', email: 'safi@example.com', password: 'securepass123' });
  assert.equal(result.name, 'Safi User');
  assert.equal(result.email, 'safi@example.com');
});
test('registration rejects weak passwords', () => {
  assert.throws(() => parse(registerSchema, { name: 'A User', email: 'a@example.com', password: '123' }), /password/);
});
test('login rejects invalid email', () => {
  assert.throws(() => parse(loginSchema, { email: 'not-an-email', password: 'hello' }), /email/);
});
test('server validation only permits known monitoring modes', () => {
  assert.throws(() => parse(serverSchema, { name: 'API Server', hostname: 'api.example.com', monitoringMode: 'fake' }), /monitoringMode/);
});
test('alert thresholds are bounded between 1 and 100', () => {
  assert.throws(() => parse(alertSchema, { name: 'High CPU', metric: 'cpu', threshold: 101, severity: 'critical', consecutiveEvaluations: 3 }), /threshold/);
});
test('alert schema accepts a valid rule', () => {
  const rule = parse(alertSchema, { name: 'CPU warning', metric: 'cpu', threshold: 80, severity: 'warning', consecutiveEvaluations: 2 });
  assert.equal(rule.threshold, 80);
  assert.equal(rule.consecutiveEvaluations, 2);
});
