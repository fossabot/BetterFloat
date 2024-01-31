import { Extension } from '../@typings/ExtensionTypes';
import { EventData, ItemStyle } from '../@typings/FloatTypes';
import { Waxpeer } from '../@typings/Waxpeer';
import { activateHandler } from '../eventhandler';
import { loadBuffMapping, loadMapping } from '../mappinghandler';
import { initSettings } from '../util/extensionsettings';
import { getBuffPrice, handleSpecialStickerNames } from '../util/helperfunctions';

async function init() {
    if (!location.hostname.includes('waxpeer.com')) {
        return;
    }

    console.log('[BetterFloat] Starting BetterFloat');
    console.time('[BetterFloat] Waxpeer init timer');
    // catch the events thrown by the script
    // this has to be done as first thing to not miss timed events
    activateHandler();

    extensionSettings = await initSettings();

    if (!extensionSettings.enableSkinbid) {
        console.log('[BetterFloat] Waxpeer disabled');
        return;
    }

    console.group('[BetterFloat] Loading mappings...');
    await loadMapping();
    await loadBuffMapping();
    console.groupEnd();

    console.timeEnd('[BetterFloat] Waxpeer init timer');
}

export function processWaxpeerEvent(eventData: EventData<unknown>) {
    console.debug('[BetterFloat] Received data from url: ' + eventData.url + ', data:', eventData.data);

    if (eventData.url.includes('api/data/index/')) {
        adjustMarketData(eventData.url, eventData.data as Waxpeer.MarketData);
    }
}

async function adjustMarketData(url: string, data: Waxpeer.MarketData) {
    // await new Promise((resolve) => setTimeout(resolve, 2000));

    const items = Array.from(document.querySelectorAll('#catalog_items .item_wrap'));
    const skipParam = parseInt(url.split('skip=')[1].split('&')[0]);

    console.debug('[BetterFloat] Adjusting market data, skip param: ' + skipParam);

    for (let i = 0; i < data.items.length; i++) {
        const itemContainer = items[i + skipParam];
        let item_id = itemContainer.querySelector('a.thumb.null')?.getAttribute('href')?.split('/')[3];
        const item = data.items[i];

        while (!item_id) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            item_id = itemContainer.querySelector('a.thumb.null')?.getAttribute('href')?.split('/')[3];
        }


        console.debug('[BetterFloat] Processing item: ', item_id, item);
        if (item_id != item.item_id) {
            console.warn('[BetterFloat] Item id mismatch, skipping item: ' + item_id);
            continue;
        }

        const priceContainer = itemContainer.querySelector('.prices');

        const buff_name = handleSpecialStickerNames(item.name);
        let itemStyle: ItemStyle = '';
        if (item.market_name.includes('Doppler')) {
            itemStyle = item.market_name.substring(item.market_name.indexOf(" ") + 1) as ItemStyle;
        }
        let { priceListing, priceOrder } = await getBuffPrice(buff_name, itemStyle);

        const buffContainer = document.createElement('div');
        priceContainer?.insertAdjacentElement('beforebegin', buffContainer);

        generateBuffContainer(buffContainer as HTMLElement, priceListing, priceOrder, '$', false);
    }
}

function generateBuffContainer(container: HTMLElement, priceListing: number, priceOrder: number, currencySymbol: string, isItemPage = false) {
    if (!isItemPage) {
        container.className += ' betterfloat-buffprice';
    }
    const buffContainer = document.createElement('div');
    buffContainer.className = 'betterfloat-buff-container';
    buffContainer.style.display = 'flex';
    buffContainer.style.marginTop = '5px';
    buffContainer.style.alignItems = 'center';
    const buffImage = document.createElement('img');
    buffImage.setAttribute('src', extensionSettings.runtimePublicURL + '/buff_favicon.png');
    buffImage.setAttribute('style', `height: 20px; margin-right: 5px; ${isItemPage ? 'margin-bottom: 1px;' : ''}`);
    buffContainer.appendChild(buffImage);
    const buffPrice = document.createElement('div');
    buffPrice.setAttribute('class', 'suggested-price betterfloat-buffprice');
    if (isItemPage) {
        buffPrice.style.fontSize = '18px';
    }
    const buffPriceBid = document.createElement('span');
    buffPriceBid.setAttribute('style', 'color: orange;');
    buffPriceBid.textContent = `Bid ${currencySymbol}${priceOrder.toFixed(2)}`;
    buffPrice.appendChild(buffPriceBid);
    const buffPriceDivider = document.createElement('span');
    buffPriceDivider.setAttribute('style', 'color: gray;margin: 0 3px 0 3px;');
    buffPriceDivider.textContent = '|';
    buffPrice.appendChild(buffPriceDivider);
    const buffPriceAsk = document.createElement('span');
    buffPriceAsk.setAttribute('style', 'color: greenyellow;');
    buffPriceAsk.textContent = `Ask ${currencySymbol}${priceListing.toFixed(2)}`;
    buffPrice.appendChild(buffPriceAsk);
    buffContainer.appendChild(buffPrice);
    if (priceOrder > priceListing) {
        const warningImage = document.createElement('img');
        warningImage.setAttribute('src', extensionSettings.runtimePublicURL + '/triangle-exclamation-solid.svg');
        warningImage.setAttribute(
            'style',
            `height: 20px; margin-left: 5px; filter: brightness(0) saturate(100%) invert(28%) sepia(95%) saturate(4997%) hue-rotate(3deg) brightness(103%) contrast(104%);${
                isItemPage ? 'margin-bottom: 1px;' : ''
            }`
        );
        buffContainer.appendChild(warningImage);
    }
    container.replaceWith(buffContainer);
}

let extensionSettings: Extension.Settings;
init();

