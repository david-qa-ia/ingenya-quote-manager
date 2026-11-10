import { workUnitSymbols } from '../data/workUnits';
import type { QuoteLine } from '../types/quote';
import type { ReactNode } from 'react';
import { calculateLineSubtotal, type QuoteTotals } from '../utils/quoteCalculations';
import { currencyFormatter } from '../utils/quoteFormatting';
import { QuoteTotalsBreakdown } from './QuoteTotalsBreakdown';

/** The line being edited in place, with the values typed so far. */
export interface LineEditing {
  lineId: string;
  quantity: string;
  onQuantityChange: (value: string) => void;
  unitPrice: string;
  onUnitPriceChange: (value: string) => void;
  error: string;
  onSave: (lineId: string) => void;
  onCancel: () => void;
}

interface Props {
  lines: readonly QuoteLine[];
  totals: QuoteTotals;
  /** The discount field, shown next to the total once there are services. */
  discountField: ReactNode;
  editing: LineEditing | null;
  onEditStart: (line: QuoteLine) => void;
  onDelete: (lineId: string) => void;
  onContinue: () => void;
}

/** "Servicios del presupuesto" in the editor: edit or remove lines and continue to the summary. */
export function QuoteLinesEditor({
  lines,
  totals,
  discountField,
  editing,
  onEditStart,
  onDelete,
  onContinue,
}: Props) {
  return (
    <section className="quote-card" aria-labelledby="quote-lines-title">
      <div className="quote-heading">
        <div>
          <p className="eyebrow">Detalle</p>
          <h2 id="quote-lines-title">Servicios del presupuesto</h2>
        </div>
        <span className="line-count">
          {lines.length} {lines.length === 1 ? 'servicio' : 'servicios'}
        </span>
      </div>

      {lines.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">＋</span>
          <h3>Todavía no agregaste servicios</h3>
          <p>Elegí uno del catálogo o cargalo manualmente para empezar el presupuesto.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Unidad</th>
                <th className="numeric-cell">Cantidad</th>
                <th className="numeric-cell">Precio unitario</th>
                <th className="numeric-cell">Subtotal</th>
                <th className="actions-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const isEditing = editing?.lineId === line.id;

                return (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.name}</strong>
                      {line.description && <small>{line.description}</small>}
                      <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                    </td>
                    <td>{workUnitSymbols[line.unit]}</td>
                    <td className="numeric-cell">
                      {isEditing ? (
                        <input
                          className="line-edit-input"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={editing?.quantity}
                          onChange={(event) => editing?.onQuantityChange(event.target.value)}
                          aria-label={`Cantidad de ${line.name}`}
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="numeric-cell">
                      {isEditing ? (
                        <input
                          className="line-edit-input line-edit-price"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={editing?.unitPrice}
                          onChange={(event) => editing?.onUnitPriceChange(event.target.value)}
                          aria-label={`Precio unitario de ${line.name}`}
                        />
                      ) : (
                        currencyFormatter.format(line.unitPrice)
                      )}
                    </td>
                    <td className="numeric-cell subtotal">
                      {currencyFormatter.format(
                        calculateLineSubtotal(line.quantity, line.unitPrice),
                      )}
                    </td>
                    <td className="actions-cell">
                      {isEditing ? (
                        <>
                          <div className="line-actions">
                            <button
                              className="button button-line button-save"
                              type="button"
                              onClick={() => editing?.onSave(line.id)}
                            >
                              Guardar
                            </button>
                            <button
                              className="button button-line"
                              type="button"
                              onClick={editing?.onCancel}
                            >
                              Cancelar
                            </button>
                          </div>
                          {editing?.error && (
                            <small className="line-edit-error" role="alert">
                              {editing?.error}
                            </small>
                          )}
                        </>
                      ) : (
                        <div className="line-actions">
                          <button
                            className="button button-line"
                            type="button"
                            onClick={() => onEditStart(line)}
                          >
                            Editar
                          </button>
                          <button
                            className="button button-line button-delete"
                            type="button"
                            onClick={() => onDelete(line.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lines.length > 0 && discountField}
      <footer className="quote-footer">
        <QuoteTotalsBreakdown
          totals={totals}
          totalLabel="Total del presupuesto"
          className="grand-total"
        />
        <button
          className="button button-primary"
          type="button"
          disabled={lines.length === 0}
          onClick={onContinue}
        >
          Continuar presupuesto <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  );
}
