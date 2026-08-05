import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end coverage for job photo attachments (Fase 9): real multipart
 * uploads against a real, fully-booted app — file type/size validation,
 * download round-tripping the exact bytes, and that the multi-tenant
 * isolation every other route gets also holds here (a caller from another
 * organization can neither list nor download).
 */
describe('job attachments (e2e)', () => {
  let app: INestApplication;
  let uploadsDir: string;

  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  beforeAll(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'dos-job-attachments-e2e-'));
    process.env.UPLOADS_DIR = uploadsDir;

    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  const server = () => app.getHttpServer();
  const runId = randomUUID();

  let ownerToken: string;
  let jobId: string;
  let attachmentId: string;

  beforeAll(async () => {
    const signup = await request(server())
      .post('/auth/signup')
      .send({
        organizationName: 'Attachments Test Co',
        industryVerticalCode: 'CLEANING',
        ownerEmail: `attachments-owner-${runId}@e2e-test.local`,
        ownerFirstName: 'Owner',
        ownerLastName: 'Test',
        password: 'Sup3rSecret!23',
      })
      .expect(201);
    ownerToken = signup.body.accessToken;

    const client = await request(server())
      .post('/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Attachments Client', type: 'RESIDENTIAL' })
      .expect(201);

    const job = await request(server())
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ clientId: client.body.id })
      .expect(201);
    jobId = job.body.id;
  });

  it('uploads a real image, round-tripping the exact bytes on download', async () => {
    const upload = await request(server())
      .post(`/jobs/${jobId}/attachments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', PNG_1X1, { filename: 'evidence.png', contentType: 'image/png' })
      .expect(201);

    expect(upload.body.fileName).toBe('evidence.png');
    expect(upload.body.mimeType).toBe('image/png');
    expect(upload.body.sizeBytes).toBe(PNG_1X1.length);
    attachmentId = upload.body.id;

    const list = await request(server())
      .get(`/jobs/${jobId}/attachments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(attachmentId);

    const download = await request(server())
      .get(`/jobs/${jobId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(download.body, PNG_1X1)).toBe(0);
  });

  it('rejects a non-image file with 415', async () => {
    await request(server())
      .post(`/jobs/${jobId}/attachments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(415);
  });

  it("hides the job's attachments from a caller in a different organization", async () => {
    const otherSignup = await request(server())
      .post('/auth/signup')
      .send({
        organizationName: 'Other Org',
        industryVerticalCode: 'CLEANING',
        ownerEmail: `other-org-owner-${runId}@e2e-test.local`,
        ownerFirstName: 'Other',
        ownerLastName: 'Owner',
        password: 'Sup3rSecret!23',
      })
      .expect(201);
    const otherToken = otherSignup.body.accessToken;

    await request(server())
      .get(`/jobs/${jobId}/attachments`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server())
      .get(`/jobs/${jobId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
