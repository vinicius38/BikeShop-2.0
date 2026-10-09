import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Printer,
  XCircle,
  Wrench,
  AlertTriangle,
} from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);
import { saleService } from '../../services/saleService';
import { Sale } from '../../types/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Pagination } from '../common/Pagination';
import { EmptyState } from '../common/EmptyState';
import { NewSaleModal } from './NewSaleModal';
import { SalePrintModal } from './SalePrintModal';
import { getSaleStatusLabel } from '../../utils/statusUtils';

interface SalesListViewProps {
  initialSaleId?: number | null;
  onNavigateToWorkOrder?: (woId: number) => void;
}

export const SalesListView: React.FC<SalesListViewProps> = ({
  initialSaleId,
  onNavigateToWorkOrder,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [printSale, setPrintSale] = useState<Sale | null>(null);

  // Cancel Sale Modal
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await saleService.getAll({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setSales(res.items);
      setTotalItems(res.totalItems);
      setTotalPages(res.totalPages);

      if (initialSaleId) {
        const found = res.items.find((s) => s.id === initialSaleId);
        if (found) setPrintSale(found);
      }
    } catch (err) {
      console.warn('Erro ao carregar vendas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, startDate, endDate, initialSaleId]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleConfirmCancelSale = async () => {
    if (!saleToCancel) return;
    setIsCancelling(true);
    try {
      await saleService.cancel(saleToCancel.id, cancelReason);
      setSaleToCancel(null);
      setCancelReason('');
      await loadSales();
    } catch (err: any) {
      console.error('Erro ao cancelar venda:', err);
      alert(err.message || 'Erro ao cancelar a venda.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#F8F8F8] tracking-tight">Vendas</h2>
          <p className="text-xs text-[#ACB0B0]">
            Controle de balcão, vendas diretas e faturamento de ordens de serviço
          </p>
        </div>

        <button
          onClick={() => setIsNewSaleOpen(true)}
          className="px-4 py-2.5 rounded-lg bg-[#EF7410] hover:bg-[#EF7410]/90 text-white font-semibold text-xs shadow-lg shadow-[#EF7410]/20 transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Venda
        </button>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-4 rounded-xl bg-[#0B1424] border border-[#1F2E45] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#ACB0B0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar por número ou cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#121E30] border border-[#1F2E45] text-xs text-white placeholder-[#ACB0B0] outline-hidden focus:border-[#EF7410]"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#121E30] border border-[#1F2E45] text-xs text-white outline-hidden focus:border-[#EF7410]"
          >
            <option value="">Todos os Status</option>
            <option value="Completed">Concluída</option>
            <option value="Cancelled">Cancelada</option>
          </select>
        </div>

        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#121E30] border border-[#1F2E45] text-xs text-white outline-hidden focus:border-[#EF7410]"
            title="Data Inicial"
          />
        </div>

        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#121E30] border border-[#1F2E45] text-xs text-white outline-hidden focus:border-[#EF7410]"
            title="Data Final"
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl border border-[#1F2E45] bg-[#0B1424] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F2E45] bg-[#121E30]/70 text-[11px] font-semibold uppercase tracking-wider text-[#ACB0B0]">
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Observação</th>
                <th className="py-3 px-4 text-right whitespace-nowrap min-w-[120px]">Total</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2E45] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#ACB0B0]">
                    <span className="w-5 h-5 border-2 border-[#EF7410] border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Carregando vendas...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8">
                    <EmptyState
                      icon={ShoppingBag}
                      title="Nenhuma venda encontrada"
                      description="Realize uma nova venda no balcão ou fature uma Ordem de Serviço."
                      actionText="Nova Venda"
                      onAction={() => setIsNewSaleOpen(true)}
                    />
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const paymentsArray = sale.payments || (sale as any).salePayments || [];
                  const paymentLabels = paymentsArray
                    .map((p: any) => p.paymentMethodName || p.paymentMethod?.name || p.paymentMethod)
                    .join(', ');

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-[#121E30]/50 transition-colors group cursor-pointer"
                      onClick={() => setPrintSale(sale)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white group-hover:text-[#EF7410] transition-colors">
                        {sale.number}
                      </td>
                      <td className="py-3 px-4 text-[#ACB0B0] font-mono text-[11px]">
                        {new Date(sale.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {sale.customerName || (
                          <span className="text-[#ACB0B0] font-normal italic">
                            Consumidor Final
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {sale.workOrderNumber ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (sale.workOrderId && onNavigateToWorkOrder) {
                                onNavigateToWorkOrder(sale.workOrderId);
                              }
                            }}
                            className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-[#EF7410] hover:underline cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            OS #{sale.workOrderNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-[#ACB0B0]">Balcão / Direta</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#ACB0B0] text-xs truncate max-w-[120px]" title={sale.notes || ''}>
                        {sale.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                        R$ {Number(sale.total).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#ACB0B0] text-[11px] truncate max-w-[140px]">
                        {paymentLabels || 'Pendente'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={(sale.status === 'Completed' || sale.status === '2' || sale.status === 2) ? 'success' : (sale.status === 'Cancelled' || sale.status === '3' || sale.status === 3) ? 'danger' : 'neutral'}
                          size="sm"
                        >
                          {getSaleStatusLabel(sale.statusName || sale.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintSale(sale);
                            }}
                            className="p-1.5 rounded-lg text-[#ACB0B0] hover:text-[#EF7410] hover:bg-[#18263A] transition-colors cursor-pointer"
                            title="Imprimir Comprovante de Venda"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintSale(sale);
                            }}
                            className="p-1.5 rounded-lg text-[#ACB0B0] hover:text-[#22C55E] hover:bg-[#22C55E]/15 transition-colors cursor-pointer"
                            title="Enviar para WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </button>

                          {sale.status !== 'Cancelled' && sale.status !== '3' && sale.status !== 3 && (
                            <button
                              onClick={() => {
                                setSaleToCancel(sale);
                                setCancelReason('');
                              }}
                              className="p-1.5 rounded-lg text-[#ACB0B0] hover:text-[#EF4444] hover:bg-[#EF4444]/15 transition-colors cursor-pointer"
                              title="Cancelar Venda e Devolver Produtos ao Estoque"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {/* New Sale Modal */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSuccess={(created) => {
          loadSales();
          setPrintSale(created);
        }}
      />

      {/* Receipt Print Modal */}
      <SalePrintModal
        isOpen={!!printSale}
        onClose={() => setPrintSale(null)}
        sale={printSale}
      />

      {/* Cancel Sale Modal with Reason & Stock Reversion Warning */}
      {saleToCancel && (
        <Modal
          isOpen={!!saleToCancel}
          onClose={() => setSaleToCancel(null)}
          title={`Cancelar Venda ${saleToCancel.number}`}
          subtitle="Os produtos serão devolvidos ao estoque e a venda será cancelada"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-white">
            <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Confirmação de Cancelamento e Estorno</strong>
                Deseja realmente cancelar a venda <strong>{saleToCancel.number}</strong> no valor de <strong>R$ {Number(saleToCancel.total).toFixed(2)}</strong>?
                Os produtos vendidos nesta transação retornarão imediatamente ao estoque.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#ACB0B0] uppercase mb-1">
                Motivo do Cancelamento
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Desistência do cliente, erro no lançamento, etc."
                className="w-full p-2.5 rounded-lg bg-[#121E30] border border-[#1F2E45] text-white outline-hidden focus:border-[#EF7410]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#1F2E45]">
              <button
                type="button"
                onClick={() => setSaleToCancel(null)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-lg bg-[#121E30] hover:bg-[#18263A] border border-[#1F2E45] text-[#ACB0B0] hover:text-white cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelSale}
                disabled={isCancelling}
                className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
