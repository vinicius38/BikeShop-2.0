import React, { useState, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Sale, Customer, Bicycle, WorkOrder } from '../../types/api';
import { useWorkshop } from '../../context/WorkshopContext';
import { customerService } from '../../services/customerService';
import { workOrderService } from '../../services/workOrderService';
import { bicycleService } from '../../services/bicycleService';
import { toBlob } from 'html-to-image';

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

interface SalePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export const SalePrintModal: React.FC<SalePrintModalProps> = ({
  isOpen,
  onClose,
  sale,
}) => {
  const { settings, logoUrl, workshopName, tradeName } = useWorkshop();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [bicycle, setBicycle] = useState<Bicycle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && sale) {
      if (sale.customerId) {
        customerService.getById(sale.customerId).then(res => setCustomer(res)).catch(console.error);
      }
      if (sale.workOrderId) {
        workOrderService.getById(sale.workOrderId).then(res => {
          setWorkOrder(res);
          if (res.bicycleId) {
            bicycleService.getById(res.bicycleId).then(bRes => setBicycle(bRes)).catch(console.error);
          }
        }).catch(console.error);
      }
    } else {
      setCustomer(null);
      setWorkOrder(null);
      setBicycle(null);
    }
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Comprovante de Venda ${sale.number}`}
      subtitle="Recibo detalhado de venda"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="flex justify-end gap-2 no-print">
          <button
            onClick={async () => {
              setIsGenerating(true);
              try {
                const element = document.getElementById('printable-sale');
                if (!element) return;
                
                // For a good quality snapshot without borders
                element.classList.remove('rounded-xl', 'shadow-lg', 'border', 'border-slate-200');
                element.style.padding = '32px';

                const blob = await toBlob(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
                
                // Re-apply original classes
                element.classList.add('rounded-xl', 'shadow-lg', 'border', 'border-slate-200');
                element.style.padding = '';

                if (!blob) throw new Error('Falha ao gerar o arquivo de imagem.');

                // 1. Tenta baixar a imagem como backup infalível
                try {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Venda_${sale.number}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error('Download failed', e);
                }

                let finalCustomer = customer;
                if (!finalCustomer && sale.customerId) {
                  try {
                    // Try to fetch synchronously to ensure we have the phone
                    const { customerService } = await import('../../services/customerService');
                    finalCustomer = await customerService.getById(sale.customerId);
                  } catch (e) {
                    console.error('Failed to fetch customer for phone fallback', e);
                  }
                }

                const rawPhone = sale.customerPhone || finalCustomer?.cellPhone || finalCustomer?.phone || '';
                const phoneDigits = rawPhone.replace(/\D/g, '');
                const finalPhone = phoneDigits ? (phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`) : '';
                
                const text = `Olá ${sale.customerName || finalCustomer?.name || 'Cliente'},\nAqui está o seu comprovante de venda.`;
                const whatsappUrl = finalPhone 
                  ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}` 
                  : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

                // 2. Copia para a área de transferência e abre o WhatsApp
                try {
                  if (typeof ClipboardItem !== 'undefined') {
                    await navigator.clipboard.write([
                      new ClipboardItem({ 'image/png': blob })
                    ]);
                  }
                } catch (clipboardErr) {
                  console.error('Clipboard failed', clipboardErr);
                  alert('Seu navegador bloqueou a cópia automática. Use a imagem que acabou de ser baixada e envie no WhatsApp.');
                }
                
                window.open(whatsappUrl, '_blank');
              } catch (error: any) {
                console.error('Error generating image', error);
                alert('Erro ao gerar imagem: ' + (error?.message || error));
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating}
            className="px-4 py-2 bg-[#22C55E] hover:bg-[#22C55E]/90 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            {isGenerating ? 'Gerando...' : 'Enviar Comprovante (WhatsApp)'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#EF7410] hover:bg-[#EF7410]/90 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comprovante
          </button>
        </div>

        {/* Printable Paper Canvas (Styled for high legibility, white print preview) */}
        <div
          id="printable-sale"
          className="bg-white text-slate-900 p-8 print:p-4 rounded-xl print:rounded-none shadow-lg print:shadow-none font-sans border border-slate-200 print:border-none text-xs print-area"
        >
          {/* Company Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden">
                <img
                  src={logoUrl}
                  alt={workshopName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                  {workshopName}
                </h1>
                {tradeName && tradeName.toLowerCase() !== workshopName.toLowerCase() && (
                  <p className="text-xs text-slate-600 font-medium">{tradeName}</p>
                )}
                <p className="text-[11px] text-slate-500 font-mono">
                  CNPJ: {settings?.formattedCpfCnpj || settings?.cpfCnpj || '12.345.678/0001-99'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {settings?.address?.formattedAddressLine || 'São Paulo - SP'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-extrabold font-mono text-[#EF7410]">
                {sale.number}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Data: {new Date((sale as any).saleDate || sale.createdAt || sale.date).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Tel: {settings?.formattedPhone || settings?.phone || '(11) 3456-7890'}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50">
            <div>
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Dados do Cliente
              </span>
              <p className="font-semibold text-slate-950 text-sm mb-1">{sale.customerName || 'Consumidor Final'}</p>
              {customer && (
                <div className="text-[11px] text-slate-700 space-y-0.5">
                  {customer.cpfCnpj && <p><strong>CPF/CNPJ:</strong> {customer.cpfCnpj}</p>}
                  {(customer.phone || customer.cellPhone) && (
                    <p><strong>Telefone:</strong> {customer.cellPhone || customer.phone}</p>
                  )}
                  {customer.email && <p><strong>E-mail:</strong> {customer.email}</p>}
                  {customer.address && (
                    <p>
                      <strong>Endereço:</strong> {customer.address.street}, {customer.address.number}
                      {customer.address.complement && ` - ${customer.address.complement}`}
                      {customer.address.neighborhood && ` - ${customer.address.neighborhood}`}
                      {customer.address.city && ` - ${customer.address.city}/${customer.address.state}`}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Origin & Bicycle Info */}
            <div>
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Dados da Origem / Vendedor
              </span>
              <p className="font-semibold text-slate-950 text-sm mb-1">
                {sale.workOrderNumber ? `OS ${sale.workOrderNumber}` : 'Venda Direta / Balcão'}
              </p>
              <div className="text-[11px] text-slate-700 space-y-0.5 mb-2">
                <p><strong>Vendedor:</strong> {sale.sellerName || 'Sistema'}</p>
              </div>
              
              {workOrder && bicycle && (
                <>
                  <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1 mt-2">
                    Bicicleta
                  </span>
                  <div className="text-[11px] text-slate-700 space-y-0.5">
                    <p><strong>Marca:</strong> {bicycle.brand}</p>
                    {bicycle.color && <p><strong>Cor:</strong> {bicycle.color}</p>}
                    <p className="font-mono"><strong>Nº de Série:</strong> {bicycle.serialNumber || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-4">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
              Itens da Venda
            </span>
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border border-slate-300 p-1.5 text-left">Descrição do Item</th>
                  <th className="border border-slate-300 p-1.5 text-center w-16">Qtd</th>
                  <th className="border border-slate-300 p-1.5 text-right w-24">Valor Unit.</th>
                  <th className="border border-slate-300 p-1.5 text-right w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-1.5 font-medium">
                      {item.productName || item.serviceName || 'Item'}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{item.quantity}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono">
                      R$ {(Number(item.total) / item.quantity).toFixed(2)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold">
                      R$ {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Payments Box */}
          <div className="flex justify-end mt-6">
            <div className="w-64 border border-slate-300 rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between items-center mb-1 text-[11px]">
                <span className="text-slate-600 font-semibold">Subtotal:</span>
                <span className="font-mono text-slate-900">R$ {Number(sale.subtotal).toFixed(2)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between items-center mb-1 text-[11px] text-emerald-700">
                  <span className="font-semibold">Desconto:</span>
                  <span className="font-mono">- R$ {Number(sale.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-300 mt-2 pt-2 text-sm">
                <span className="font-black text-slate-950 uppercase">Total:</span>
                <span className="font-bold text-[#EF7410] font-mono">
                  R$ {Number(sale.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payments Detail */}
          {sale.payments?.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-2">
                Pagamentos Recebidos
              </span>
              <div className="flex gap-4 flex-wrap">
                {sale.payments?.map((p, idx) => (
                  <div key={idx} className="bg-slate-100 px-3 py-1.5 rounded text-[11px] text-slate-700 font-medium">
                    {p.paymentMethodName || p.paymentMethod}: <span className="font-mono ml-1 font-bold">R$ {Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Detail */}
          {sale.notes && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Observações
              </span>
              <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                {sale.notes}
              </p>
            </div>
          )}

          {/* Footer Message */}
          <div className="mt-8 text-center text-[10px] text-slate-500 italic">
            <p>{settings?.footerMessage || 'Obrigado por escolher a Nilson Bikes! Volte sempre.'}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
