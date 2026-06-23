import { Injectable } from '@nestjs/common';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';
import { calcComparativeRanges, DAY_MS } from 'src/common/utils/zoned-time.util';
import { AnalyticsService } from 'src/modules/analytics/analytics.service';
import { DashboardSummaryModel } from './models/dashboard.models';

/**
 * Тонкий сборщик данных для главной страницы: вызывает переиспользуемый
 * AnalyticsService и компонует ответ для GraphQL. Вся математика — в AnalyticsService.
 *
 * Денежные значения уже приходят как Money из AnalyticsService и структурно
 * совпадают с MoneyModel, поэтому маппинг — простой проброс.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly settingsService: SettingsService,
  ) {}

  async getSummary(
    ctx: AuthContext,
    overrideTz?: string | null,
  ): Promise<DashboardSummaryModel> {
    const tz =
      overrideTz ?? (await this.settingsService.getTimezone(ctx.tenantId));
    const now = new Date();
    const [workDayMinutes, currencyCode] = await Promise.all([
      this.settingsService.getWorkDayMinutes(ctx.tenantId),
      this.settingsService.getDefaultCurrencyCode(ctx.tenantId),
    ]);
    const ranges = calcComparativeRanges(now, tz);
    const recommendationsRange = {
      from: new Date(now.getTime() - 90 * DAY_MS),
      to: now,
    };
    const { tenantId, tenantGroupId } = ctx;

    const [
      incomeLast7Days,
      revenueLast7Days,
      walletBalances,
      employeeDebts,
      operations,
      monthlyRevenue,
      warrantyLast30Days,
      openOrdersTotals,
      avgCheckCur,
      avgCheckMom,
      avgCheckYoy,
      marginCur,
      marginMom,
      marginYoy,
      recoCurrent,
      monthlyClients,
      mechanicHourRevenue,
    ] = await Promise.all([
      this.analytics.getIncomeLast7Days(tenantId, tz, now, currencyCode),
      this.analytics.getRevenueLast7Days(tenantId, tz, now, currencyCode),
      this.analytics.getWalletBalances(tenantId, currencyCode),
      this.analytics.getEmployeeDebts(tenantId, currencyCode),
      this.analytics.getOperationsKpi(tenantId),
      this.analytics.getMonthlyRevenueLast6(tenantId, tz, now, currencyCode),
      this.analytics.getWarrantyLast30Days(tenantId, now, currencyCode),
      this.analytics.getOpenOrdersTotals(tenantId, currencyCode),
      this.analytics.getAvgCheck(tenantId, ranges.current, currencyCode),
      this.analytics.getAvgCheck(tenantId, ranges.momPrev, currencyCode),
      this.analytics.getAvgCheck(tenantId, ranges.yoyPrev, currencyCode),
      this.analytics.getPartsMargin(tenantId, ranges.current, currencyCode),
      this.analytics.getPartsMargin(tenantId, ranges.momPrev, currencyCode),
      this.analytics.getPartsMargin(tenantId, ranges.yoyPrev, currencyCode),
      this.analytics.getRecommendations(tenantGroupId, recommendationsRange),
      this.analytics.getMonthlyClientsLast6(tenantId, tz, now),
      this.analytics.getMechanicHourRevenue(
        tenantId,
        tz,
        now,
        workDayMinutes,
        currencyCode,
      ),
    ]);

    return {
      incomeLast7Days,
      revenueLast7Days,
      walletBalances,
      employeeDebts,
      operations,
      monthlyRevenue,
      warrantyLast30Days,
      openOrdersTotals,
      avgCheck: {
        current: avgCheckCur,
        momPrevious: avgCheckMom,
        yoyPrevious: avgCheckYoy,
      },
      partsMargin: {
        current: marginCur,
        momPrevious: marginMom,
        yoyPrevious: marginYoy,
      },
      recommendations: {
        current: recoCurrent,
      },
      monthlyClients,
      mechanicHourRevenue,
    };
  }
}
