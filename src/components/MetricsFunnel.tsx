import type { CommercialMetrics } from '../types/commercialMetrics';
const rate = (value: number | null) =>
  value === null ? '— · Sin base suficiente' : `${value.toFixed(1)}%`;
export function MetricsFunnel({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-funnel">
      <h2 id="metrics-funnel">Embudo comercial</h2>
      <dl className="metrics-funnel">
        <div>
          <dt>Oportunidades con resultado definitivo</dt>
          <dd>{metrics.opportunityConversion.denominator}</dd>
        </div>
        <div>
          <dt>Oportunidades ganadas</dt>
          <dd>{metrics.opportunityConversion.numerator}</dd>
        </div>
        <div>
          <dt>Conversión por oportunidad</dt>
          <dd>{rate(metrics.opportunityConversion.rate)}</dd>
        </div>
        <div>
          <dt>Presupuestos enviados</dt>
          <dd>{metrics.quoteConversion.denominator}</dd>
        </div>
        <div>
          <dt>Presupuestos aceptados</dt>
          <dd>{metrics.quoteConversion.numerator}</dd>
        </div>
        <div>
          <dt>Conversión por presupuesto</dt>
          <dd>{rate(metrics.quoteConversion.rate)}</dd>
        </div>
      </dl>
    </section>
  );
}
