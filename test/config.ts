export const BUNNI_SMART_WALLET_CHECKER = '0x0CCdf95bAF116eDE5251223Ca545D0ED02287a8f';
export const BALANCER_20WETH_80LIT = '0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C';
export const OLIT = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";

export const gauges = [
    {
        gauge: '0xa718193E1348FD4dEF3063E7F4b4154BAAcB0214',
        bunniLp: '0x846A4566802C27eAC8f72D594F4Ca195Fe41C07a',
    }
]

export const whales = [
    {
        asset: BALANCER_20WETH_80LIT,
        whale: '0xb84dfdD51d18B1613432bfaE91dfcC48899D4151',
    },
    {
        asset: gauges[0].bunniLp,
        whale: '0xfb17199BB361dAED5B8dF4E0d263f2f6CB990C50',
    }
]