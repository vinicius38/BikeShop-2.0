import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to convert PascalCase to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// Helper to find model name ignoring hyphens
function getModelName(entity: string) {
  const cleanEntity = entity.replace(/-/g, '').toLowerCase();
  return Object.keys(prisma).find(k => k.toLowerCase() === cleanEntity || k.toLowerCase() === cleanEntity.slice(0, -1));
}

export async function GET(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const params = await context.params;
  const { slug } = params;
  const path = slug.join('/').toLowerCase();
  
  try {
    // Auth mock
    if (path === 'auth/me') {
      return NextResponse.json({
        success: true,
        data: {
          id: 1,
          name: 'Administrador',
          username: 'admin',
          email: 'admin@oficinabike.com',
          isActive: true,
          roleId: 1,
          roleName: 'Administrador',
          permissions: [],
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      });
    }

    // Dashboard
    if (path === 'dashboard') {
      const now = new Date();
      
      // Start/End of Today (Local)
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Start/End of Last 30 Days (instead of current month)
      const startOfMonth = new Date(now);
      startOfMonth.setDate(startOfMonth.getDate() - 30);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now);
      endOfMonth.setHours(23, 59, 59, 999);

      const p = prisma as any;

      const [
        woGroup,
        salesToday,
        salesMonth,
        woMonthCount,
        lowStockProductsCount,
        lowStockProductsData
      ] = await Promise.all([
        p.workOrders.groupBy({
          by: ['Status'],
          _count: true
        }),
        p.sales.aggregate({
          where: { SaleDate: { gte: startOfDay, lte: endOfDay }, Status: 2 },
          _count: true,
          _sum: { Total: true }
        }),
        p.sales.aggregate({
          where: { SaleDate: { gte: startOfMonth, lte: endOfMonth }, Status: 2 },
          _count: true,
          _sum: { Total: true }
        }),
        p.workOrders.count({
          where: { CreatedAt: { gte: startOfMonth, lte: endOfMonth } }
        }),
        p.$queryRaw`SELECT COUNT(*) as count FROM "Products" WHERE "StockQuantity" <= "MinimumStock" AND "IsActive" = true`,
        p.$queryRaw`SELECT "Id", "Sku" as "Code", "Name", "StockQuantity", "MinimumStock" as "MinimumStockQuantity", "Unit" FROM "Products" WHERE "StockQuantity" <= "MinimumStock" AND "IsActive" = true LIMIT 5`
      ]);

      const getWoCount = (status: number) => {
        const item = woGroup.find((g: any) => g.Status === status);
        return item ? item._count : 0;
      };

      const openWorkOrders = getWoCount(1);
      const waitingApprovalWorkOrders = getWoCount(2);
      const inProgressWorkOrders = getWoCount(4);
      const waitingPartsWorkOrders = getWoCount(5);
      const readyWorkOrders = getWoCount(6);
      const deliveredWorkOrders = getWoCount(7);
      
      const totalActiveWorkOrders = woGroup
        .filter((g: any) => g.Status !== 7 && g.Status !== 8) // Exclude Delivered(7) and Cancelled(8)
        .reduce((sum: number, g: any) => sum + g._count, 0);

      const parsedLowStockCount = Array.isArray(lowStockProductsCount) && lowStockProductsCount.length > 0 
        ? Number(lowStockProductsCount[0].count) 
        : 0;

      const last7DaysStart = new Date(now);
      last7DaysStart.setDate(last7DaysStart.getDate() - 6);
      last7DaysStart.setHours(0, 0, 0, 0);

      const salesMovement = await p.sales.findMany({
        where: { SaleDate: { gte: last7DaysStart }, Status: 2 },
        select: { SaleDate: true, WorkOrderId: true, Total: true, SaleItems: { select: { ProductId: true, ServiceId: true, Total: true } } }
      });

      const weeklyMovement = [];
      const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(last7DaysStart);
        d.setDate(d.getDate() + i);
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        let vendas = 0;
        let servicos = 0;
        const daySales = salesMovement.filter((s: any) => {
          return s.SaleDate >= dayStart && s.SaleDate <= dayEnd;
        });
        daySales.forEach((sale: any) => {
           let saleTotal = Number(sale.Total || 0);
           if (sale.WorkOrderId) {
              servicos += saleTotal;
           } else {
              vendas += saleTotal;
           }
        });
        
        weeklyMovement.push({
           dia: daysOfWeek[d.getDay()],
           vendas: Number(vendas.toFixed(2)),
           servicos: Number(servicos.toFixed(2))
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          openWorkOrders,
          waitingApprovalWorkOrders,
          inProgressWorkOrders,
          waitingPartsWorkOrders,
          readyWorkOrders,
          deliveredWorkOrders,
          totalActiveWorkOrders,
          salesTodayCount: salesToday._count || 0,
          salesTodayAmount: Number(salesToday._sum.Total || 0),
          salesThisMonthCount: salesMonth._count || 0,
          salesThisMonthAmount: Number(salesMonth._sum.Total || 0),
          workOrdersThisMonthCount: woMonthCount,
          lowStockProductsCount: parsedLowStockCount,
          lowStockProducts: toCamelCase(lowStockProductsData || []).map((p: any) => ({
            ...p,
            unit: { 1: 'UN', 2: 'KG', 3: 'L', 4: 'MT', 5: 'PAR', 6: 'CX' }[p.unit as number] || p.unit || 'UN'
          })),
          weeklyMovement
        }
      });
    }

    if (path.startsWith('reports/')) {
      const p = prisma as any;
      const url = new URL(request.url);
      const startDate = url.searchParams.get('StartDate') || url.searchParams.get('startDate');
      const endDate = url.searchParams.get('EndDate') || url.searchParams.get('endDate');

      const buildDateWhere = (dateField: string) => {
        if (!startDate && !endDate) return undefined;
        const where: any = {};
        if (startDate) where.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.lte = end;
        }
        return where;
      };

      if (path === 'reports/sales') {
        const where = buildDateWhere('SaleDate');
        const sales = await p.sales.findMany({
          where: where ? { SaleDate: where } : undefined,
          include: { Customers: true },
          orderBy: { SaleDate: 'desc' }
        });

        let total = 0;
        let count = 0;
        const items = sales.map((s: any) => {
          total += Number(s.Total || 0);
          count++;
          return {
            saleNumber: s.Number,
            customerName: s.Customers?.Name,
            amount: s.Total,
            date: s.SaleDate
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            report: {
              title: 'Relatório de Vendas',
              summary: { totalSales: count, totalAmount: total, averageTicket: count > 0 ? total / count : 0 },
              items
            }
          }
        });
      }

      if (path === 'reports/work-orders') {
        const where = buildDateWhere('OpeningDate');
        const wos = await p.workOrders.findMany({
          where: where ? { OpeningDate: where } : undefined,
          include: { Customers: true },
          orderBy: { OpeningDate: 'desc' }
        });

        let total = 0;
        let count = 0;
        const items = wos.map((s: any) => {
          total += Number(s.Total || 0);
          count++;
          return {
            workOrderNumber: s.Number,
            customerName: s.Customers?.Name,
            amount: s.Total,
            date: s.OpeningDate
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            report: {
              title: 'Relatório de Ordens de Serviço',
              summary: { totalWorkOrders: count, totalAmount: total, averageTicket: count > 0 ? total / count : 0 },
              items
            }
          }
        });
      }

      if (path === 'reports/financial') {
        const where = buildDateWhere('SaleDate');
        const sales = await p.sales.findMany({
          where: where ? { SaleDate: where, Status: 2 } : { Status: 2 },
          include: { Customers: true, SalePayments: { include: { PaymentMethods: true } } },
          orderBy: { SaleDate: 'desc' }
        });

        let total = 0;
        let count = 0;
        const byMethod: any = {};
        const items: any[] = [];

        sales.forEach((s: any) => {
          total += Number(s.Total || 0);
          count++;
          s.SalePayments?.forEach((p: any) => {
            const method = p.PaymentMethods?.Name || 'Outro';
            byMethod[method] = (byMethod[method] || 0) + Number(p.Amount || 0);
          });
          items.push({
            saleNumber: s.Number,
            customerName: s.Customers?.Name,
            amount: s.Total,
            date: s.SaleDate
          });
        });

        return NextResponse.json({
          success: true,
          data: {
            report: {
              title: 'Relatório Financeiro',
              summary: {
                totalReceived: total,
                transactionsCount: count,
                byMethod: Object.keys(byMethod).map(k => ({ method: k, totalAmount: byMethod[k] }))
              },
              items
            }
          }
        });
      }

      if (path === 'reports/customers') {
        const where = buildDateWhere('CreatedAt');
        const customers = await p.customers.findMany({
          where: where ? { CreatedAt: where } : undefined,
          orderBy: { CreatedAt: 'desc' }
        });

        return NextResponse.json({
          success: true,
          data: {
            report: {
              title: 'Relatório de Clientes',
              summary: { totalCustomers: customers.length },
              items: customers.map((c: any) => ({
                code: c.Id,
                name: c.Name,
                amount: 0,
                date: c.CreatedAt
              }))
            }
          }
        });
      }

      if (path === 'reports/stock') {
        const products = await p.products.findMany({
          where: { IsActive: true },
          orderBy: { Name: 'asc' }
        });

        let totalValue = 0;
        const items = products.map((p: any) => {
          const val = Number(p.StockQuantity || 0) * Number(p.CostPrice || 0);
          totalValue += val;
          return {
            code: p.Sku || String(p.Id),
            name: p.Name,
            amount: p.StockQuantity,
            salePrice: p.SalePrice,
            total: val
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            report: {
              title: 'Relatório de Posição de Estoque',
              summary: { totalProducts: products.length, totalStockValue: totalValue },
              items
            }
          }
        });
      }
    }

    if (path === 'stock/movements') {
      const p = prisma as any;
      const url = new URL(request.url);
      
      const page = parseInt(url.searchParams.get('Page') || url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('PageSize') || url.searchParams.get('pageSize') || '50');
      const skip = (page - 1) * pageSize;

      const movementType = url.searchParams.get('type') || url.searchParams.get('movementType');
      const startDate = url.searchParams.get('StartDate') || url.searchParams.get('startDate');
      const endDate = url.searchParams.get('EndDate') || url.searchParams.get('endDate');

      const whereClause: any = {};
      if (movementType) {
        whereClause.MovementType = movementType;
      }
      if (startDate || endDate) {
        whereClause.CreatedAt = {};
        if (startDate) {
          whereClause.CreatedAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause.CreatedAt.lte = end;
        }
      }

      const totalItems = await p.stockMovements.count({ where: Object.keys(whereClause).length > 0 ? whereClause : undefined });
      const result = await p.stockMovements.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        include: {
          Products: true,
          Users: true,
        },
        orderBy: { CreatedAt: 'desc' },
        skip,
        take: pageSize
      });

      const transformedResult = result.map((m: any) => ({
        id: m.Id,
        productId: m.ProductId,
        productCode: m.Products?.Sku || '',
        productName: m.Products?.Name || '',
        quantity: m.Quantity,
        previousStock: m.PreviousStock,
        newStock: m.NewStock,
        movementType: m.MovementType,
        reason: m.Reason,
        createdAt: m.CreatedAt,
        operatorName: m.Users?.Name || 'Sistema',
      }));

      return NextResponse.json({
        success: true,
        data: {
          items: transformedResult,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
          page,
          pageSize
        }
      });
    }

    if (path === 'workshop-settings/logo') {
      const settings = await prisma.workshopSettings.findFirst();
      if (settings && settings.LogoData && settings.LogoContentType) {
        return new NextResponse(settings.LogoData as any, {
          headers: {
            'Content-Type': settings.LogoContentType,
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }
      return NextResponse.json({ success: false, message: 'Logo not found' }, { status: 404 });
    }

    const entity = slug[0];
    
    // Specific Item GET
    if (slug.length === 2 && !isNaN(Number(slug[1]))) {
      const id = Number(slug[1]);
      const modelName = getModelName(entity);
      
      if (modelName) {
        const includeConfig: any = {};
        if (modelName === 'sales') {
          includeConfig.include = { 
            Customers: true, 
            SalePayments: { include: { PaymentMethods: true } },
            SaleItems: { include: { Products: true, Services: true } },
            WorkOrders: true
          };
        } else if (modelName === 'workOrders') {
          includeConfig.include = { 
            Customers: true, 
            Bicycles: true,
            Users_WorkOrders_AssignedToUserIdToUsers: true,
            Users_WorkOrders_CreatedByUserFkIdToUsers: true,
            WorkOrderItems: { include: { Products: true, Services: true } }
          };
        } else if (modelName === 'customers') {
          includeConfig.include = { Addresses: true };
        } else if (modelName === 'products') {
          includeConfig.include = { ProductCategories: true, Suppliers: true };
        } else if (modelName === 'suppliers') {
          includeConfig.include = { Addresses: true };
        } else if (modelName === 'users') {
          includeConfig.include = { Roles: true };
        }

        const result = await (prisma as any)[modelName].findUnique({ 
          where: { Id: id },
          ...includeConfig 
        });
        
        if (!result) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        
        let transformedResult = result;
        if (modelName === 'sales') {
          transformedResult = {
            id: result.Id,
            number: result.Number,
            date: result.SaleDate,
            customerId: result.CustomerId,
            customerName: result.Customers?.Name,
            customerPhone: result.Customers?.CellPhone || result.Customers?.Phone || '',
            workOrderId: result.WorkOrderId,
            workOrderNumber: result.WorkOrders?.Number,
            sellerName: result.Users_Sales_CreatedByUserIdToUsers?.Name || 'Sistema',
            subtotal: result.Subtotal,
            discount: result.Discount,
            additionalCharge: result.AdditionalCharge,
            total: result.Total,
            status: result.Status,
            payments: result.SalePayments?.map((p: any) => ({
              paymentMethod: p.PaymentMethods?.Name,
              amount: p.Amount,
              installments: p.Installments
            })) || [],
            items: result.SaleItems?.map((item: any) => ({
              id: item.Id,
              productId: item.ProductId,
              productName: item.Products?.Name,
              serviceId: item.ServiceId,
              serviceName: item.Services?.Name,
              quantity: item.Quantity,
              unitPrice: item.UnitPrice,
              total: item.Total
            })) || []
          };
        } else {
          transformedResult = toCamelCase(result);
          
          if (modelName === 'workOrders') {
            if (transformedResult.usersWorkOrdersAssignedToUserIdToUsers) {
              transformedResult.assignedToUserName = transformedResult.usersWorkOrdersAssignedToUserIdToUsers.name;
              delete transformedResult.usersWorkOrdersAssignedToUserIdToUsers;
            }
            if (transformedResult.usersWorkOrdersCreatedByUserFkIdToUsers) {
              transformedResult.createdByUserName = transformedResult.usersWorkOrdersCreatedByUserFkIdToUsers.name;
              delete transformedResult.usersWorkOrdersCreatedByUserFkIdToUsers;
            }
            if (transformedResult.workOrderItems) {
              transformedResult.items = transformedResult.workOrderItems.map((item: any) => ({
                id: item.id,
                workOrderId: item.workOrderId,
                itemType: item.itemType === 1 ? 'Product' : 'Service',
                itemTypeName: item.itemType === 1 ? 'Product' : 'Service',
                productId: item.productId,
                productName: item.products?.name,
                productSku: item.products?.code,
                serviceId: item.serviceId,
                serviceName: item.services?.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                total: item.total
              }));
              delete transformedResult.workOrderItems;
            }
            const statusMap: Record<number, string> = {
              1: 'Open', 2: 'WaitingApproval', 3: 'Approved', 4: 'InProgress',
              5: 'WaitingParts', 6: 'Ready', 7: 'Delivered', 8: 'Cancelled'
            };
            transformedResult.status = statusMap[transformedResult.status] || 'Open';
            transformedResult.statusName = statusMap[transformedResult.status] || 'Open';
          } else if (modelName === 'products') {
            transformedResult.categoryId = transformedResult.productCategoryId;
            delete transformedResult.productCategoryId;
            if (transformedResult.minimumStock !== undefined) {
              transformedResult.minimumStockQuantity = transformedResult.minimumStock;
            }
            if (typeof transformedResult.unit === 'number') {
              const reverseUnitMap: Record<number, string> = { 1: 'UN', 2: 'KG', 3: 'L', 4: 'MT', 5: 'PAR', 6: 'CX' };
              transformedResult.unit = reverseUnitMap[transformedResult.unit] || 'UN';
            }
          } else if (modelName === 'customers' && transformedResult.addresses) {
            transformedResult.address = transformedResult.addresses;
            delete transformedResult.addresses;
          } else if (modelName === 'suppliers') {
            if (transformedResult.addresses) {
              transformedResult.address = transformedResult.addresses;
              delete transformedResult.addresses;
            }
            if (transformedResult.cpfCnpj !== undefined) {
              transformedResult.cnpj = transformedResult.cpfCnpj;
            }
          } else if (modelName === 'bicycles') {
            const reverseTypeMap: Record<number, string> = {
              1: 'Mountain Bike (MTB)',
              2: 'Speed / Road',
              3: 'Urbana / Passeio',
              4: 'E-Bike / Elétrica',
              5: 'Infantil',
              6: 'Dobravel',
              7: 'Outra'
            };
            transformedResult.type = reverseTypeMap[transformedResult.bikeType] || 'Outra';
            if (transformedResult.customers) {
              transformedResult.customerName = transformedResult.customers.name;
            }
            if (transformedResult.bikeType !== undefined) {
              delete transformedResult.bikeType;
            }
          } else if (modelName === 'products') {
            const reverseUnitMap: Record<number, string> = {
              1: 'UN', 2: 'KG', 3: 'L', 4: 'MT', 5: 'PAR', 6: 'CX'
            };
          if (typeof transformedResult.unit === 'number') {
            transformedResult.unit = reverseUnitMap[transformedResult.unit] || 'UN';
          }
          if (transformedResult.productCategories) {
            transformedResult.categoryName = transformedResult.productCategories.name;
          }
          if (transformedResult.suppliers) {
            transformedResult.supplierName = transformedResult.suppliers.tradeName || transformedResult.suppliers.corporateName;
          }
          if (transformedResult.minimumStock !== undefined) {
            transformedResult.minimumStockQuantity = transformedResult.minimumStock;
          }
          } else if (modelName === 'suppliers') {
            if (transformedResult.cpfCnpj !== undefined) {
              transformedResult.cnpj = transformedResult.cpfCnpj;
              delete transformedResult.cpfCnpj;
            }
            transformedResult.contactPerson = '';
            if (transformedResult.addresses) {
              transformedResult.address = transformedResult.addresses;
              delete transformedResult.addresses;
            }
          }
        }
        
        return NextResponse.json({ success: true, data: transformedResult });
      }
    }

    // List GET
    if (slug.length === 1) {
      const modelName = getModelName(entity);
      if (modelName) {
        let result;
        // Workshop settings is usually unique
        if (modelName === 'workshopSettings') {
            result = await prisma.workshopSettings.findFirst({
              include: { Addresses: true }
            });
            if (!result) {
               return NextResponse.json({ success: true, data: { id: 1, companyName: 'Oficina Bike' } });
            }
            // Format address back to frontend structure
            const data = toCamelCase(result);
            if (data.addresses) {
              const a = data.addresses;
              a.formattedAddressLine = `${a.street || ''}, ${a.number || 'S/N'}${a.complement ? ` - ${a.complement}` : ''} - ${a.neighborhood || ''} - ${a.city || ''}/${a.state || ''}`.trim().replace(/^[,\s-]+|[,\s-]+$/g, '');
              data.address = a;
              delete data.addresses;
            }
            
            // Format CPF/CNPJ
            if (data.cpfCnpj) {
              const cleaned = data.cpfCnpj.replace(/\D/g, '');
              if (cleaned.length === 11) {
                data.formattedCpfCnpj = cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
              } else if (cleaned.length === 14) {
                data.formattedCpfCnpj = cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
              } else {
                data.formattedCpfCnpj = data.cpfCnpj;
              }
            }
            
            // Format Phone
            if (data.phone) {
              const cleaned = data.phone.replace(/\D/g, '');
              if (cleaned.length === 11) {
                data.formattedPhone = cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
              } else if (cleaned.length === 10) {
                data.formattedPhone = cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
              } else {
                data.formattedPhone = data.phone;
              }
            }

            // Add logo properties explicitly
            data.hasLogo = !!result.LogoData;
            if (data.hasLogo) {
              data.logoUrl = `/api/workshop-settings/logo?t=${new Date(result.UpdatedAt || Date.now()).getTime()}`;
            }
            
            // Do not send LogoData bytes to frontend
            delete data.logoData;

            return NextResponse.json({ success: true, data });
        } else {
            const includeConfig: any = {};
            if (modelName === 'sales') {
              includeConfig.include = { 
                Customers: true, 
                SalePayments: { include: { PaymentMethods: true } },
                SaleItems: { include: { Products: true, Services: true } },
                WorkOrders: true,
                Users_Sales_CreatedByUserIdToUsers: true

              };
            } else if (modelName === 'workOrders') {
              includeConfig.include = { Customers: true, Bicycles: true };
            } else if (modelName === 'customers') {
              includeConfig.include = { Addresses: true };
            } else if (modelName === 'products') {
              includeConfig.include = { ProductCategories: true, Suppliers: true };
            } else if (modelName === 'suppliers') {
              includeConfig.include = { Addresses: true };
            } else if (modelName === 'users') {
              includeConfig.include = { Roles: true };
            }
            const url = new URL(request.url);
            const search = url.searchParams.get('Search');
            const categoryId = url.searchParams.get('CategoryId');
            const isLowStock = url.searchParams.get('IsLowStock');
            const customerIdParam = url.searchParams.get('CustomerId') || url.searchParams.get('customerId');
            
            let whereClause: any = {};
            if (modelName === 'sales') {
              const startDate = url.searchParams.get('StartDate') || url.searchParams.get('startDate');
              const endDate = url.searchParams.get('EndDate') || url.searchParams.get('endDate');
              const status = url.searchParams.get('Status') || url.searchParams.get('status');
              if (startDate || endDate) {
                whereClause.SaleDate = {};
                if (startDate) whereClause.SaleDate.gte = new Date(startDate);
                if (endDate) {
                  const end = new Date(endDate);
                  end.setHours(23, 59, 59, 999);
                  whereClause.SaleDate.lte = end;
                }
              }
              if (status) {
                whereClause.Status = Number(status);
              }
            } else if (modelName === 'products') {
              if (search) {
                whereClause.OR = [
                  { Name: { contains: search, mode: 'insensitive' } },
                  { Sku: { contains: search, mode: 'insensitive' } },
                  { Barcode: { contains: search, mode: 'insensitive' } }
                ];
              }
              if (categoryId) {
                whereClause.ProductCategoryId = Number(categoryId);
              }
              if (isLowStock === 'true') {
                const lowStockQuery: any[] = await (prisma as any).$queryRaw`SELECT "Id" FROM "Products" WHERE "StockQuantity" <= "MinimumStock" AND "IsActive" = true`;
                const lowStockIds = lowStockQuery.map(p => p.Id);
                whereClause.Id = { in: lowStockIds };
              }
            } else if (modelName === 'bicycles') {
              if (customerIdParam) {
                whereClause.CustomerId = Number(customerIdParam);
              }
            }

            const page = parseInt(url.searchParams.get('Page') || url.searchParams.get('page') || '1');
            const pageSize = parseInt(url.searchParams.get('PageSize') || url.searchParams.get('pageSize') || '50');
            const skip = (page - 1) * pageSize;

            result = await (prisma as any)[modelName].findMany({ 
              take: pageSize,
              skip: skip,
              orderBy: { Id: 'desc' }, 
              where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
              ...includeConfig 
            });
            
            // Re-fetch totals for pagination metadata
            const totalItems = Object.keys(whereClause).length > 0 
                ? await (prisma as any)[modelName].count({ where: whereClause })
                : await (prisma as any)[modelName].count();
            
            let transformedResult = result;
            if (modelName === 'sales') {
              transformedResult = result.map((sale: any) => ({
                id: sale.Id,
                number: sale.Number,
                date: sale.SaleDate,
                customerId: sale.CustomerId,
                customerName: sale.Customers?.Name,
                customerPhone: sale.Customers?.CellPhone || sale.Customers?.Phone,
                workOrderId: sale.WorkOrderId,
                workOrderNumber: sale.WorkOrders?.Number,
                sellerName: sale.Users_Sales_CreatedByUserIdToUsers?.Name || 'Sistema',
                subtotal: sale.Subtotal,
                discount: sale.Discount,
                additionalCharge: sale.AdditionalCharge,
                total: sale.Total,
                status: sale.Status,
                payments: sale.SalePayments?.map((p: any) => ({
                  paymentMethod: p.PaymentMethods?.Name,
                  amount: p.Amount,
                  installments: p.Installments
                })) || [],
                items: sale.SaleItems?.map((item: any) => ({
                  id: item.Id,
                  productId: item.ProductId,
                  productName: item.Products?.Name,
                  serviceId: item.ServiceId,
                  serviceName: item.Services?.Name,
                  quantity: item.Quantity,
                  unitPrice: item.UnitPrice,
                  total: item.Total
                })) || []
              }));
            } else if (modelName === 'workOrders') {
              const statusMap: Record<number, string> = {
                1: 'Open', 2: 'WaitingApproval', 3: 'Approved', 4: 'InProgress',
                5: 'WaitingParts', 6: 'Ready', 7: 'Delivered', 8: 'Cancelled'
              };
              transformedResult = result.map((os: any) => ({
                id: os.Id,
                number: os.Number,
                customerName: os.Customers?.Name,
                customerPhone: os.Customers?.Phone || os.Customers?.Mobile,
                bicycleBrand: os.Bicycles?.Brand,
                bicycleModel: os.Bicycles?.Model,
                bicycleSerialNumber: os.Bicycles?.SerialNumber,
                openingDate: os.OpeningDate,
                total: os.Total,
                status: statusMap[os.Status] || 'Open'
              }));
            } else {
              transformedResult = toCamelCase(result);
              if (modelName === 'customers') {
                transformedResult = transformedResult.map((c: any) => {
                  if (c.addresses) {
                    c.address = c.addresses;
                    delete c.addresses;
                  }
                  return c;
                });

              } else if (modelName === 'bicycles') {
                const reverseTypeMap: Record<number, string> = {
                  1: 'Mountain Bike (MTB)',
                  2: 'Speed / Road',
                  3: 'Urbana / Passeio',
                  4: 'E-Bike / Elétrica',
                  5: 'Infantil',
                  6: 'Dobravel',
                  7: 'Outra'
                };
                transformedResult = transformedResult.map((b: any) => {
                  b.type = reverseTypeMap[b.bikeType] || 'Outra';
                  if (b.customers) {
                    b.customerName = b.customers.name;
                  }
                  if (b.bikeType !== undefined) {
                    delete b.bikeType;
                  }
                  return b;
                });
              } else if (modelName === 'products') {
                const reverseUnitMap: Record<number, string> = {
                  1: 'UN', 2: 'KG', 3: 'L', 4: 'MT', 5: 'PAR', 6: 'CX'
                };
                transformedResult = transformedResult.map((p: any) => {
                  if (typeof p.unit === 'number') {
                    p.unit = reverseUnitMap[p.unit] || 'UN';
                  }
                  if (p.productCategories) {
                    p.categoryName = p.productCategories.name;
                  }
                  if (p.suppliers) {
                    p.supplierName = p.suppliers.tradeName || p.suppliers.corporateName;
                  }
                  if (p.minimumStock !== undefined) {
                    p.minimumStockQuantity = p.minimumStock;
                  }
                  p.categoryId = p.productCategoryId;
                  delete p.productCategoryId;
                  return p;
                });
              } else if (modelName === 'suppliers') {
                transformedResult = transformedResult.map((s: any) => {
                  if (s.cpfCnpj !== undefined) {
                    s.cnpj = s.cpfCnpj;
                    delete s.cpfCnpj;
                  }
                  s.contactPerson = '';
                  if (s.addresses) {
                    s.address = s.addresses;
                    delete s.addresses;
                  }
                  return s;
                });
              } else if (modelName === 'users') {
                transformedResult = transformedResult.map((u: any) => {
                  if (u.roles) {
                    u.roleName = u.roles.name;
                    delete u.roles;
                  } else if (u.Roles) {
                    u.roleName = u.Roles.Name;
                  }
                  return u;
                });
              }
            }
            

            return NextResponse.json({ 
              success: true, 
              data: {
                items: transformedResult,
                page: page,
                pageSize: pageSize,
                totalItems: typeof totalItems !== 'undefined' ? totalItems : result.length,
                totalPages: typeof totalItems !== 'undefined' ? Math.ceil(totalItems / pageSize) || 1 : Math.ceil(result.length / pageSize) || 1,
                hasPreviousPage: page > 1,
                hasNextPage: typeof totalItems !== 'undefined' ? page * pageSize < totalItems : false
              }
            });
        }
      }
    }
    
    return NextResponse.json({ success: false, message: 'Route not mapped in dynamic handler' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const params = await context.params;
  const { slug } = params;
  const path = slug.join('/').toLowerCase();
  
  try {
    if (path === 'workshop-settings/logo') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const settings = await prisma.workshopSettings.findFirst();
      
      if (settings) {
        await prisma.workshopSettings.update({
          where: { Id: settings.Id },
          data: {
            LogoFileName: file.name,
            LogoContentType: file.type,
            LogoData: buffer,
            UpdatedAt: new Date()
          }
        });
      } else {
        await prisma.workshopSettings.create({
          data: {
            CompanyName: 'Oficina Padrão',
            TradeName: 'Oficina Padrão',
            CorporateName: 'Oficina Padrão',
            IsActive: true,
            CreatedAt: new Date(),
            LogoFileName: file.name,
            LogoContentType: file.type,
            LogoData: buffer
          }
        });
      }

      return NextResponse.json({ 
        success: true, 
        data: { 
          fileName: file.name, 
          logoUrl: `/api/workshop-settings/logo?t=${Date.now()}` 
        } 
      });
    }

    const body = await request.json().catch(() => ({}));

    if (path === 'auth/login') {
      const loginIdentifier = body.username || body.email;
      const user = await prisma.users.findFirst({ 
        where: { 
          OR: [
            { Email: { equals: loginIdentifier, mode: 'insensitive' } },
            { Username: { equals: loginIdentifier, mode: 'insensitive' } }
          ],
          PasswordHash: body.password
        },
        include: { Roles: true }
      });
      
      if (user) {
        return NextResponse.json({
          success: true,
          data: {
            accessToken: 'mock-jwt-token-vercel',
            user: { id: user.Id, name: user.Name, email: user.Email, roleName: user.Roles?.Name || 'Colaborador' }
          }
        });
      }

      // Hardcoded fallback for default admin if not in DB
      if (body.username === 'admin' && body.password === 'Admin@123456') {
        return NextResponse.json({
          success: true,
          data: {
            accessToken: 'mock-jwt-token-vercel',
            user: { id: 1, name: 'Admin', email: 'admin@admin.com', roleName: 'Administrador' }
          }
        });
      }

      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    if (slug.length === 3 && slug[0].toLowerCase() === 'products' && slug[2].toLowerCase() === 'stock') {
      const productId = Number(slug[1]);
      if (isNaN(productId)) {
        return NextResponse.json({ success: false, message: 'Invalid product ID' }, { status: 400 });
      }
      
      const product = await prisma.products.findUnique({ where: { Id: productId } });
      if (!product) {
         return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
      }

      let typeInt = 4;
      if (body.type === 'Purchase') typeInt = 1;
      else if (body.type === 'Sale') typeInt = 2;
      else if (body.type === 'WorkOrder') typeInt = 3;
      else if (body.type === 'Adjustment') typeInt = 4;
      else if (body.type === 'Loss') typeInt = 7;
      
      const newStock = Number(product.StockQuantity) + Number(body.quantity);

      await prisma.stockMovements.create({
        data: {
          ProductId: productId,
          Type: typeInt,
          Quantity: Number(body.quantity),
          PreviousStock: product.StockQuantity,
          NewStock: newStock,
          UnitCost: product.CostPrice,
          Description: body.reason || '',
          CreatedAt: new Date(),
          CreatedByUserId: 1 
        }
      });

      await prisma.products.update({
        where: { Id: productId },
        data: {
          StockQuantity: newStock,
          UpdatedAt: new Date()
        }
      });

      return NextResponse.json({ success: true, data: { stockQuantity: newStock } });
    }

    if (slug.length === 3 && slug[0].toLowerCase() === 'work-orders' && slug[2].toLowerCase() === 'status') {
      const workOrderId = Number(slug[1]);
      if (isNaN(workOrderId)) {
        return NextResponse.json({ success: false, message: 'Invalid work order ID' }, { status: 400 });
      }
      
      const workOrder = await prisma.workOrders.findUnique({ where: { Id: workOrderId } });
      if (!workOrder) {
         return NextResponse.json({ success: false, message: 'Work order not found' }, { status: 404 });
      }

      const statusMapToId: Record<string, number> = {
        'Open': 1, 'WaitingApproval': 2, 'Approved': 3, 'InProgress': 4,
        'WaitingParts': 5, 'Ready': 6, 'Delivered': 7, 'Cancelled': 8
      };
      
      const statusId = typeof body.status === 'string' ? statusMapToId[body.status] : body.status;

      const updated = await prisma.workOrders.update({
        where: { Id: workOrderId },
        data: { Status: statusId || 1, UpdatedAt: new Date() }
      });

      const transformedUpdated = toCamelCase(updated);
      const reverseStatusMap: Record<number, string> = {
        1: 'Open', 2: 'WaitingApproval', 3: 'Approved', 4: 'InProgress',
        5: 'WaitingParts', 6: 'Ready', 7: 'Delivered', 8: 'Cancelled'
      };
      transformedUpdated.status = reverseStatusMap[updated.Status] || 'Open';
      
      return NextResponse.json({ success: true, data: transformedUpdated });
    }

    if (slug.length === 3 && slug[0].toLowerCase() === 'sales' && slug[2].toLowerCase() === 'cancel') {
      const saleId = Number(slug[1]);
      if (isNaN(saleId)) {
        return NextResponse.json({ success: false, message: 'Invalid sale ID' }, { status: 400 });
      }
      
      const sale = await prisma.sales.findUnique({ 
        where: { Id: saleId },
        include: { SaleItems: true }
      });
      if (!sale) {
         return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 });
      }

      if (sale.Status === 3) {
         return NextResponse.json({ success: false, message: 'Sale is already cancelled' }, { status: 400 });
      }

      // Restore stock for items
      for (const item of sale.SaleItems) {
        if (item.ProductId) {
          const product = await prisma.products.findUnique({ where: { Id: item.ProductId } });
          if (product) {
            const newStock = Number(product.StockQuantity || 0) + Number(item.Quantity);
            
            await prisma.stockMovements.create({
              data: {
                ProductId: product.Id,
                Type: 1, // 1 = Entry (returning to stock)
                Quantity: Number(item.Quantity),
                PreviousStock: product.StockQuantity,
                NewStock: newStock,
                UnitCost: product.CostPrice,
                Description: body?.reason || `Cancelamento da Venda ${sale.Number}`,
                CreatedAt: new Date(),
                CreatedByUserId: 1 
              }
            });

            await prisma.products.update({
              where: { Id: product.Id },
              data: {
                StockQuantity: newStock,
                UpdatedAt: new Date()
              }
            });
          }
        }
      }

      // Update sale status
      const updatedSale = await prisma.sales.update({
        where: { Id: saleId },
        data: { Status: 3, UpdatedAt: new Date() } // 3 = Cancelled
      });

      return NextResponse.json({ success: true, data: toCamelCase(updatedSale) });
    }

    const entity = slug[0];
    const modelName = getModelName(entity);
    
    if (modelName && slug.length === 1) {
      const addressData = body.address;
      delete body.address;

      const pascalBody: any = {};
      for (const key in body) {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        pascalBody[pascalKey] = body[key];
      }

      if (addressData) {
        const pascalAddress: any = {};
        for (const key in addressData) {
          const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
          pascalAddress[pascalKey] = addressData[key];
        }
        pascalAddress.CreatedAt = new Date();
        const newAddress = await prisma.addresses.create({ data: pascalAddress });
        pascalBody.AddressId = newAddress.Id;
      }

      pascalBody.CreatedAt = new Date();
      if (typeof pascalBody.IsActive === 'undefined') {
        pascalBody.IsActive = true;
      }

      if (modelName === 'bicycles') {
        if (pascalBody.Type) {
          const typeMap: Record<string, number> = {
            'Mountain Bike (MTB)': 1,
            'Speed / Road': 2,
            'Urbana / Passeio': 3,
            'E-Bike / Elétrica': 4,
            'Infantil': 5,
            'Dobravel': 6,
            'Outra': 7
          };
          pascalBody.BikeType = typeMap[pascalBody.Type as string] || 7;
          delete pascalBody.Type;
        }
        delete pascalBody.IsActive;
      } else if (modelName === 'products') {
        if (pascalBody.Unit && typeof pascalBody.Unit === 'string') {
          const unitMap: Record<string, number> = {
            'UN': 1, 'KG': 2, 'L': 3, 'MT': 4, 'PAR': 5, 'CX': 6
          };
          pascalBody.Unit = unitMap[pascalBody.Unit.toUpperCase()] || 1;
        }
        if (pascalBody.Code !== undefined) {
          pascalBody.Sku = String(pascalBody.Code);
          delete pascalBody.Code;
        }
        if (pascalBody.CategoryId !== undefined) {
          pascalBody.ProductCategoryId = Number(pascalBody.CategoryId);
          delete pascalBody.CategoryId;
        }
        if (pascalBody.MinimumStockQuantity !== undefined) {
          pascalBody.MinimumStock = Number(pascalBody.MinimumStockQuantity);
          delete pascalBody.MinimumStockQuantity;
        }
        if (pascalBody.InitialStock !== undefined) {
          delete pascalBody.InitialStock;
        }
        if (pascalBody.Barcode === '') {
          pascalBody.Barcode = null;
        }
        if (pascalBody.SupplierId === '') {
          pascalBody.SupplierId = null;
        }
        pascalBody.RowVersion = Buffer.alloc(0);
      } else if (modelName === 'suppliers') {
        if (pascalBody.Cnpj !== undefined) {
          pascalBody.CpfCnpj = pascalBody.Cnpj;
          delete pascalBody.Cnpj;
        }
        if (pascalBody.ContactPerson !== undefined) {
          delete pascalBody.ContactPerson;
        }
      } else if (modelName === 'workOrders') {
        if (!pascalBody.Number) {
          const lastOs = await prisma.workOrders.findFirst({ orderBy: { Id: 'desc' } });
          const nextId = lastOs ? lastOs.Id + 1 : 1;
          pascalBody.Number = `OS-${String(nextId).padStart(6, '0')}`;
        }
        if (pascalBody.Items !== undefined) {
          delete pascalBody.Items;
        }
        if (pascalBody.Status === undefined) {
          pascalBody.Status = 1; // Open
        }
        if (pascalBody.Total === undefined) {
          pascalBody.Total = 0;
        }
        if (pascalBody.Subtotal === undefined) {
          pascalBody.Subtotal = 0;
        }
        if (!pascalBody.OpeningDate) {
          pascalBody.OpeningDate = new Date();
        }
        if (pascalBody.ApprovalStatus === undefined) {
          pascalBody.ApprovalStatus = 1; // Pending / Open
        }
        if (pascalBody.IsActive !== undefined) {
          delete pascalBody.IsActive;
        }
      } else if (modelName === 'sales') {
        if (!pascalBody.Number) {
          const lastSale = await prisma.sales.findFirst({ orderBy: { Id: 'desc' } });
          const nextId = lastSale ? lastSale.Id + 1 : 1;
          pascalBody.Number = `VENDA-${String(nextId).padStart(6, '0')}`;
        }

        if (!pascalBody.CustomerId) {
          // Look for "Consumidor Final" or create one
          let defaultCustomer = await prisma.customers.findFirst({
            where: { Name: 'Consumidor Final' }
          });
          
          if (!defaultCustomer) {
            defaultCustomer = await prisma.customers.create({
              data: {
                Name: 'Consumidor Final',
                CpfCnpj: '00000000000',
                IsActive: true,
                CreatedAt: new Date(),
              }
            });
          }
          pascalBody.CustomerId = defaultCustomer.Id;
        }
        
        if (pascalBody.Status === undefined) {
          pascalBody.Status = 2; // Default to Completed
        }
        
        if (pascalBody.SaleDate === undefined) {
          pascalBody.SaleDate = new Date();
        }

        let calculatedSubtotal = 0;

        if (pascalBody.Items && Array.isArray(pascalBody.Items)) {
          pascalBody.SaleItems = {
            create: pascalBody.Items.map((item: any) => {
              const itemQuantity = Number(item.quantity) || 1;
              const itemPrice = Number(item.unitPrice) || 0;
              const itemDiscount = Number(item.discount) || 0;
              const itemTotal = (itemQuantity * itemPrice) - itemDiscount;
              calculatedSubtotal += itemTotal;
              
              return {
                ItemType: item.itemType || 1, // Default to Product
                ProductId: item.productId,
                ServiceId: item.serviceId,
                Description: item.description || (item.productId ? 'Produto' : 'Serviço'),
                Quantity: itemQuantity,
                UnitPrice: itemPrice,
                Discount: itemDiscount,
                Total: itemTotal,
                CreatedAt: new Date()
              };
            })
          };
          delete pascalBody.Items;
        }

        if (pascalBody.Subtotal === undefined) {
          pascalBody.Subtotal = calculatedSubtotal;
        }

        if (pascalBody.AdditionalCharge === undefined) {
          pascalBody.AdditionalCharge = 0;
        }

        if (pascalBody.Discount === undefined) {
          pascalBody.Discount = 0;
        }

        if (pascalBody.Total === undefined) {
          pascalBody.Total = pascalBody.Subtotal - pascalBody.Discount + pascalBody.AdditionalCharge;
        }

        if (pascalBody.Payments && Array.isArray(pascalBody.Payments)) {
          pascalBody.SalePayments = {
            create: pascalBody.Payments.map((p: any) => ({
              PaymentMethodId: p.paymentMethodId,
              Amount: Number(p.amount) || 0,
              Installments: p.installments || 1,
              PaidAt: new Date()
            }))
          };
          delete pascalBody.Payments;
        }
        
        
        delete pascalBody.IsActive; // IsActive does not exist on Sales model
      } else if (modelName === 'users') {
        if (pascalBody.Password !== undefined) {
          pascalBody.PasswordHash = pascalBody.Password;
          delete pascalBody.Password;
        }
      }

      let includeConfig: any = undefined;
      if (modelName === 'sales') {
        includeConfig = {
          Customers: true,
          SalePayments: { include: { PaymentMethods: true } },
          SaleItems: { include: { Products: true, Services: true } },
          WorkOrders: true,
          Users_Sales_CreatedByUserIdToUsers: true
        };
      }

      const result = await (prisma as any)[modelName].create({ 
        data: pascalBody,
        include: includeConfig 
      });

      if (modelName === 'sales') {
        const transformedResult = {
          id: result.Id,
          number: result.Number,
          date: result.SaleDate,
          customerId: result.CustomerId,
          customerName: result.Customers?.Name,
          customerPhone: result.Customers?.CellPhone || result.Customers?.Phone || '',
          workOrderId: result.WorkOrderId,
          workOrderNumber: result.WorkOrders?.Number,
          sellerName: result.Users_Sales_CreatedByUserIdToUsers?.Name || 'Sistema',
          subtotal: result.Subtotal,
          discount: result.Discount,
          additionalCharge: result.AdditionalCharge,
          total: result.Total,
          status: result.Status,
          payments: result.SalePayments?.map((p: any) => ({
            paymentMethod: p.PaymentMethods?.Name,
            amount: p.Amount,
            installments: p.Installments
          })) || [],
          items: result.SaleItems?.map((item: any) => ({
            id: item.Id,
            productId: item.ProductId,
            productName: item.Products?.Name,
            serviceId: item.ServiceId,
            serviceName: item.Services?.Name,
            quantity: item.Quantity,
            unitPrice: item.UnitPrice,
            total: item.Total
          })) || []
        };
        return NextResponse.json({ success: true, data: transformedResult });
      }

      return NextResponse.json({ success: true, data: toCamelCase(result) });
    }

    return NextResponse.json({ success: false, message: 'Route not mapped' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const params = await context.params;
  const { slug } = params;
  
  try {
    const body = await request.json().catch(() => ({}));
    const path = slug.join('/').toLowerCase();

    // Workshop Settings PUT
    if (path === 'workshop-settings') {
      const settings = await prisma.workshopSettings.findFirst();
      
      const addressData = body.address;
      delete body.address;
      
      const pascalBody: any = {};
      for (const key in body) {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        pascalBody[pascalKey] = body[key];
      }

      let addressId = settings?.AddressId;

      if (addressData) {
        const pascalAddress: any = {};
        for (const key in addressData) {
          const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
          pascalAddress[pascalKey] = addressData[key];
        }

        if (addressId) {
          pascalAddress.UpdatedAt = new Date();
          await prisma.addresses.update({ where: { Id: addressId }, data: pascalAddress });
        } else {
          pascalAddress.CreatedAt = new Date();
          const newAddress = await prisma.addresses.create({ data: pascalAddress });
          addressId = newAddress.Id;
        }
      }

      pascalBody.AddressId = addressId;

      if (settings) {
        pascalBody.UpdatedAt = new Date();
        const result = await prisma.workshopSettings.update({
          where: { Id: settings.Id },
          data: pascalBody
        });
        return NextResponse.json({ success: true, data: toCamelCase(result) });
      } else {
        pascalBody.CreatedAt = new Date();
        pascalBody.IsActive = true;
        const result = await prisma.workshopSettings.create({
          data: pascalBody
        });
        return NextResponse.json({ success: true, data: toCamelCase(result) });
      }
    }

    const entity = slug[0];

    if (entity.toLowerCase() === 'users' && slug.length === 4 && slug[1].toLowerCase() === 'roles' && slug[3].toLowerCase() === 'permissions') {
      const roleId = Number(slug[2]);
      const { permissions } = body;
      
      if (Array.isArray(permissions)) {
        const dbPerms = await prisma.permissions.findMany({
          where: { Code: { in: permissions } }
        });
        
        await prisma.rolePermissions.deleteMany({
          where: { RoleId: roleId }
        });
        
        if (dbPerms.length > 0) {
          await prisma.rolePermissions.createMany({
            data: dbPerms.map(p => ({
              RoleId: roleId,
              PermissionId: p.Id
            }))
          });
        }
      }
      
      return NextResponse.json({ success: true });
    }
    
    if (slug.length === 2 && !isNaN(Number(slug[1]))) {
      const id = Number(slug[1]);
      const modelName = getModelName(entity);
      
      if (modelName) {
        const addressData = body.address;
        delete body.address;

        const pascalBody: any = {};
        for (const key in body) {
          const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
          pascalBody[pascalKey] = body[key];
        }

        if (addressData) {
          const pascalAddress: any = {};
          for (const key in addressData) {
            const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
            pascalAddress[pascalKey] = addressData[key];
          }

          const existingRecord = await (prisma as any)[modelName].findUnique({ where: { Id: id } });
          
          if (existingRecord?.AddressId) {
            pascalAddress.UpdatedAt = new Date();
            await prisma.addresses.update({ where: { Id: existingRecord.AddressId }, data: pascalAddress });
            pascalBody.AddressId = existingRecord.AddressId;
          } else {
            pascalAddress.CreatedAt = new Date();
            const newAddress = await prisma.addresses.create({ data: pascalAddress });
            pascalBody.AddressId = newAddress.Id;
          }
        }

        pascalBody.UpdatedAt = new Date();

        if (modelName === 'bicycles') {
          if (pascalBody.Type) {
            const typeMap: Record<string, number> = {
              'Mountain Bike (MTB)': 1,
              'Speed / Road': 2,
              'Urbana / Passeio': 3,
              'E-Bike / Elétrica': 4,
              'Infantil': 5,
              'Dobravel': 6,
              'Outra': 7
            };
            pascalBody.BikeType = typeMap[pascalBody.Type as string] || 7;
            delete pascalBody.Type;
          }
          delete pascalBody.IsActive;
        } else if (modelName === 'products') {
          if (pascalBody.Unit && typeof pascalBody.Unit === 'string') {
            const unitMap: Record<string, number> = {
              'UN': 1, 'KG': 2, 'L': 3, 'MT': 4, 'PAR': 5, 'CX': 6
            };
            pascalBody.Unit = unitMap[pascalBody.Unit.toUpperCase()] || 1;
          }
          if (pascalBody.Code !== undefined) {
            pascalBody.Sku = String(pascalBody.Code);
            delete pascalBody.Code;
          }
          if (pascalBody.CategoryId !== undefined) {
            pascalBody.ProductCategoryId = Number(pascalBody.CategoryId);
            delete pascalBody.CategoryId;
          }
          if (pascalBody.MinimumStockQuantity !== undefined) {
            pascalBody.MinimumStock = Number(pascalBody.MinimumStockQuantity);
            delete pascalBody.MinimumStockQuantity;
          }
          if (pascalBody.InitialStock !== undefined) {
            delete pascalBody.InitialStock;
          }
          if (pascalBody.Barcode === '') {
            pascalBody.Barcode = null;
          }
          if (pascalBody.SupplierId === '') {
            pascalBody.SupplierId = null;
          }
        } else if (modelName === 'suppliers') {
          if (pascalBody.Cnpj !== undefined) {
            pascalBody.CpfCnpj = pascalBody.Cnpj;
            delete pascalBody.Cnpj;
          }
          if (pascalBody.ContactPerson !== undefined) {
            delete pascalBody.ContactPerson;
          }
        } else if (modelName === 'workOrders') {
          if (pascalBody.Status && typeof pascalBody.Status === 'string') {
            const statusMapToId: Record<string, number> = {
              'Open': 1, 'WaitingApproval': 2, 'Approved': 3, 'InProgress': 4,
              'WaitingParts': 5, 'Ready': 6, 'Delivered': 7, 'Cancelled': 8
            };
            pascalBody.Status = statusMapToId[pascalBody.Status as string] || 1;
          }
          if (pascalBody.ApprovalStatus && typeof pascalBody.ApprovalStatus === 'string') {
            const approvalMapToId: Record<string, number> = {
              'Pending': 1, 'Approved': 2, 'Rejected': 3
            };
            pascalBody.ApprovalStatus = approvalMapToId[pascalBody.ApprovalStatus as string] || 1;
          }
        } else if (modelName === 'users') {
          if (pascalBody.Password !== undefined) {
            pascalBody.PasswordHash = pascalBody.Password;
            delete pascalBody.Password;
          }
        }

        const result = await (prisma as any)[modelName].update({ where: { Id: id }, data: pascalBody });
        return NextResponse.json({ success: true, data: toCamelCase(result) });
      }
    }

    return NextResponse.json({ success: false, message: 'Route not mapped' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const params = await context.params;
  const { slug } = params;
  
  try {
    const path = slug.join('/').toLowerCase();
    
    if (path === 'workshop-settings/logo') {
      const settings = await prisma.workshopSettings.findFirst();
      if (settings) {
        await prisma.workshopSettings.update({
          where: { Id: settings.Id },
          data: {
            LogoFileName: null,
            LogoContentType: null,
            LogoData: null,
            UpdatedAt: new Date()
          }
        });
      }
      return NextResponse.json({ success: true });
    }
    const entity = slug[0];
    
    if (slug.length === 2 && !isNaN(Number(slug[1]))) {
      const id = Number(slug[1]);
      const modelName = getModelName(entity);
      
      if (modelName) {
        await (prisma as any)[modelName].delete({ where: { Id: id } });
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ success: false, message: 'Route not mapped' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
