import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { CheckoutService } from '../src/services/CheckoutService.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

describe('CheckoutService', () => {
    const cartaoCredito = { numero: '4111111111111111' };

    describe('quando o pagamento falha', () => {
        it('retorna null e nao aciona o repositorio nem o servico de e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false }),
            };
            const repositoryDummy = { salvar: jest.fn() };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryDummy,
                emailDummy,
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBeNull();
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(100, cartaoCredito);
            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrao finaliza a compra', () => {
        it('retorna o pedido salvo com o total sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const pedidoSalvo = new Pedido(101, carrinho, 100, 'PROCESSADO');
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo),
            };
            const emailStub = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailStub,
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBe(pedidoSalvo);
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(100, cartaoCredito);
            expect(repositoryStub.salvar).toHaveBeenCalledWith(
                expect.objectContaining({
                    carrinho,
                    totalFinal: 100,
                    status: 'PROCESSADO',
                }),
            );
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it('aplica o desconto e envia o e-mail de confirmacao', async () => {
            // Arrange
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([new Item('Produto Premium', 200)])
                .build();
            const pedidoSalvo = new Pedido(123, carrinho, 180, 'PROCESSADO');
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo),
            };
            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock,
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBe(pedidoSalvo);
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(repositoryStub.salvar).toHaveBeenCalledWith(
                expect.objectContaining({
                    carrinho,
                    totalFinal: 180,
                    status: 'PROCESSADO',
                }),
            );
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 123 no valor de R$180',
            );
        });
    });
});
