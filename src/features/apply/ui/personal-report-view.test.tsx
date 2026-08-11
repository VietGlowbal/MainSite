import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PersonalReport } from '../domain';
import { PersonalReportView } from './personal-report-view';

const section = {
  status: 'limited' as const,
  headline: 'Chưa đủ dữ liệu để kết luận',
  narrative: 'Hồ sơ mới có một hoạt động nên đây chỉ là nhận định ban đầu.',
  confidence: 'low' as const,
  evidenceRefs: [],
  limitation: 'Cần thêm ít nhất hai hoạt động độc lập.',
};

const report: PersonalReport = {
  summary: 'Báo cáo giới hạn do hồ sơ còn ít dữ liệu.',
  confidence: 32,
  confidenceLevel: 'low',
  limitations: ['Chưa đủ ba hoạt động độc lập.'],
  coreIdentity: section,
  drivingForce: section,
  signaturePattern: section,
  emergingThemes: [],
  personalPositioning: section,
  proofOfMe: [],
};

describe('PersonalReportView', () => {
  it('shows a limited report without inventing an overall applicant score', () => {
    render(
      <PersonalReportView
        initialReport={report}
        initialStale={false}
        generatedAt="2026-07-31T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    expect(screen.getByText('Báo cáo giới hạn do hồ sơ còn ít dữ liệu.')).toBeInTheDocument();
    expect(screen.getByText('Limited data')).toBeInTheDocument();
    expect(screen.getByText('32%')).toBeInTheDocument();
    expect(screen.queryByText(/xác suất trúng tuyển/i)).not.toBeInTheDocument();
  });
});
