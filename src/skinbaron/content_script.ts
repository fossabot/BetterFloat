import { Extension } from '../@typings/ExtensionTypes';
import { Skinbaron } from '../@typings/SkinbaronTypes';
import { activateHandler } from '../eventhandler';
import { getBuffMapping, getFirstSkinbaronItem, getPriceMapping, loadBuffMapping, loadMapping } from '../mappinghandler';
import { initSettings } from '../util/extensionsettings';
import { handleSpecialStickerNames } from '../util/helperfunctions';
import { createLanguagePopup } from '../util/uigeneration';

async function init() {
    if (!location.hostname.includes('skinbaron.de')) {
        return;
    }

    console.log('[BetterFloat] Starting BetterFloat');
    console.time('[BetterFloat] Skinbid init timer');
    // catch the events thrown by the script
    // this has to be done as first thing to not miss timed events
    activateHandler();

    extensionSettings = await initSettings();

    if (!extensionSettings.enableSkinbid) {
        console.log('[BetterFloat] Skinbid disabled');
        return;
    }

    if (document.querySelector('.flag')?.className.includes('flag-en') == false) {
        console.warn('[BetterFloat] Skinbaron language has to be English for this extension to work. Aborting ...');
        createLanguagePopup(runtimePublicURL, 'Skinbaron', () => {
            (<HTMLButtonElement>document.querySelector('.flag-en')).click();
            location.reload();
        });
        return;
    }

    console.group('[BetterFloat] Loading mappings...');
    await loadMapping();
    await loadBuffMapping();
    console.groupEnd();

    console.timeEnd('[BetterFloat] Skinbid init timer');

    await firstLaunch();

    // mutation observer is only needed once
    if (!isObserverActive) {
        isObserverActive = true;
        await applyMutation();
        console.log('[BetterFloat] Observer started');
    }
}

async function firstLaunch() {
    if (location.pathname == '/en') {
        const items = document.querySelectorAll('.promo-item');

        for (let i = 0; i < items.length; i++) {
            adjustItem(items[i], itemSelectors.promo);
        }
    } else if (location.pathname.startsWith('/en/csgo/')) {
        const items = document.querySelectorAll('.product-box');

        for (let i = 0; i < items.length; i++) {
            adjustItem(items[i], itemSelectors.card);
        }
    }
}

const itemSelectors = {
    promo: {
        name: '.lName',
        priceDiv: '.item-details-wrapper',
        saleWrapper: '.price-wrapper',
    },
    card: {
        name: '.product-name',
        priceDiv: '.product-price',
        saleWrapper: '.product-price',
    },
} as const;

type ItemSelectors = (typeof itemSelectors)[keyof typeof itemSelectors];

async function applyMutation() {
    let observer = new MutationObserver(async (mutations) => {
        if (extensionSettings.enableSkinbid) {
            for (let mutation of mutations) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    let addedNode = mutation.addedNodes[i];
                    // some nodes are not elements, so we need to check
                    if (!(addedNode instanceof HTMLElement)) continue;
                    // console.log("Added node: ", addedNode);

                    if (addedNode.className) {
                        let className = addedNode.className.toString();
                        if (className.includes('product-box')) {
                            // console.log('Found product: ', addedNode);
                            await adjustItem(addedNode, itemSelectors.card);
                        } else if (className.includes('product-card')) {
                            // offer in list on item page
                        } else if (className.includes('promo-item')) {
                            // item card
                            await adjustItem(addedNode, itemSelectors.promo);
                        } else if (className.includes('item-category')) {
                            // ?
                        }
                    }
                }
            }
        }
    });
    observer.observe(document, { childList: true, subtree: true });
}

async function adjustItem(container: Element, selector: ItemSelectors) {
    // const item = getSkinbaronItem(container);
    const item_name = getHTMLItemName(container, selector.name);

    const cachedItem = await getFirstSkinbaronItem();
    if (cachedItem) {
        const item = Object.keys(cachedItem).includes('variant') ? cachedItem as Skinbaron.MassItem : cachedItem as Skinbaron.SingleItem;
        console.log('Cached item: ', cachedItem);
        // includes instead of equality as localizedName does not contain StatTrak
        if (!item_name.includes(item.extendedProductInformation.localizedName) && !item.extendedProductInformation.localizedName.includes(item_name)) {
            console.log('Item name does not match. ', item_name, item.extendedProductInformation.localizedName);
            return;
        }
        await addBuffPrice(item, container, selector);
    }
}

async function addBuffPrice(item: Skinbaron.Item, container: Element, selector: ItemSelectors) {
    await loadMapping();
    let { buff_name, priceListing, priceOrder } = await getBuffPrice(item);
    let buff_id = await getBuffMapping(buff_name);

    let priceDiv = <HTMLElement>container.querySelector(selector.priceDiv);
    let currencySymbol: string | undefined;
    if (selector == itemSelectors.card) {
        currencySymbol = priceDiv.childNodes[2].textContent?.trim().charAt(0);
    } else {
        currencySymbol = priceDiv.children[1].children[1].textContent?.trim().split(' ')[1].charAt(0);
    }
    if (priceDiv && !container.querySelector('.betterfloat-buffprice')) {
        generateBuffContainer(priceDiv, priceListing, priceOrder, currencySymbol ?? '$', selector == itemSelectors.promo);
    }

    const buffHref = buff_id > 0 ? `https://buff.163.com/goods/${buff_id}` : `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodeURIComponent(buff_name)}`;
    const buffContainer = container.querySelector('.betterfloat-buff-container');
    if (buffContainer) {
        (<HTMLElement>buffContainer).onclick = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            window.open(buffHref, '_blank');
        };
        (<HTMLElement>buffContainer).style.alignItems = 'center';
        (<HTMLElement>buffContainer).style.justifyContent = 'center';
    }

    const difference = (isMassItem(item) ? (<Skinbaron.MassItem>item).lowestPrice : (<Skinbaron.SingleItem>item).singleOffer.itemPrice) - (extensionSettings.skbPriceReference == 1 ? priceListing : priceOrder);
    if (extensionSettings.skbBuffDifference) {
        const priceWrapper = container.querySelector(selector.saleWrapper);
        (<HTMLElement>priceWrapper).style.display = 'flex';
        let discountContainer = document.createElement('span');
        discountContainer.className += ' betterfloat-sale-tag';
        if (selector == itemSelectors.promo) {
            (<HTMLElement>priceWrapper).style.justifyContent = 'flex-end';
            discountContainer.style.marginRight = '5px';
            discountContainer.style.padding = '1px 3px';
            discountContainer.style.fontSize = '13px';
        } else {
            (<HTMLElement>priceWrapper).style.justifyContent = 'center';
            (<HTMLElement>priceWrapper).style.paddingBottom = '0px';
            const buffContainer = container.querySelector('.betterfloat-buff-container');
            if (buffContainer) {
                (<HTMLElement>buffContainer).style.marginBottom = '20px';
            }
            discountContainer.style.marginLeft = '10px';
            discountContainer.style.marginRight = '-10px';
        }
        // TODO use skinbaron colors
        discountContainer.style.backgroundColor = difference == 0 ? extensionSettings.colors.skinbid.neutral : difference < 0 ? extensionSettings.colors.skinbid.profit : extensionSettings.colors.skinbid.loss;
        discountContainer.textContent = difference == 0 ? `-${currencySymbol}0` : (difference > 0 ? '+' : '-') + currencySymbol + Math.abs(difference).toFixed(2);
        if (isMassItem(item)) {
            const discountWrapper = document.createElement('div');
            discountWrapper.style.display = 'flex';
            discountWrapper.style.alignItems = 'flex-end';
            discountWrapper.appendChild(discountContainer);
            discountContainer = discountWrapper;
        }
        if (selector == itemSelectors.promo) {
            priceWrapper?.insertBefore(discountContainer, priceWrapper.firstChild);
        } else {
            priceWrapper?.appendChild(discountContainer);
        }
    }

    return {
        price_difference: difference,
    };
}

function isMassItem(item: Skinbaron.Item) {
    return Object.keys(item).includes('variant');
}

async function generateBuffContainer(container: HTMLElement, priceListing: number, priceOrder: number, currencySymbol: string, append = false, isItemPage = false) {
    container.className += ' betterfloat-buffprice';
    const buffContainer = document.createElement('div');
    buffContainer.className = 'betterfloat-buff-container';
    buffContainer.style.display = 'flex';
    buffContainer.style.marginTop = '5px';
    buffContainer.style.alignItems = 'center';
    const buffImage = document.createElement('img');
    buffImage.setAttribute('src', runtimePublicURL + '/buff_favicon.png');
    buffImage.setAttribute('style', `height: 20px; margin-right: 5px; ${isItemPage ? 'margin-bottom: 1px;' : ''}`);
    buffContainer.appendChild(buffImage);
    const buffPrice = document.createElement('div');
    buffPrice.setAttribute('class', 'suggested-price betterfloat-buffprice');
    if (isItemPage) {
        buffPrice.style.fontSize = '18px';
    }
    const tooltipSpan = document.createElement('span');
    tooltipSpan.setAttribute('class', 'betterfloat-buff-tooltip');
    tooltipSpan.textContent = 'Bid: Highest buy order price; Ask: Lowest listing price';
    buffPrice.appendChild(tooltipSpan);
    const buffPriceBid = document.createElement('span');
    buffPriceBid.setAttribute('style', 'color: orange;');
    buffPriceBid.textContent = `Bid ${currencySymbol}${priceOrder.toFixed(2)}`;
    buffPrice.appendChild(buffPriceBid);
    const buffPriceDivider = document.createElement('span');
    buffPriceDivider.setAttribute('style', 'color: gray; margin: 0 3px 0 3px;');
    buffPriceDivider.textContent = '|';
    buffPrice.appendChild(buffPriceDivider);
    const buffPriceAsk = document.createElement('span');
    buffPriceAsk.setAttribute('style', 'color: greenyellow;');
    buffPriceAsk.textContent = `Ask ${currencySymbol}${priceListing.toFixed(2)}`;
    buffPrice.appendChild(buffPriceAsk);
    buffContainer.appendChild(buffPrice);
    if (append) {
        container.appendChild(buffContainer);
    } else {
        container.after(buffContainer);
    }
}

async function getBuffPrice(item: Skinbaron.Item): Promise<{ buff_name: string; priceListing: number; priceOrder: number }> {
    let priceMapping = await getPriceMapping();
    let buff_name = handleSpecialStickerNames(createBuffName(item));
    console.log('[BetterFloat] Buff name: ', buff_name);
    let helperPrice: number | null = null;

    if (!priceMapping[buff_name] || !priceMapping[buff_name]['buff163'] || !priceMapping[buff_name]['buff163']['starting_at'] || !priceMapping[buff_name]['buff163']['highest_order']) {
        console.debug(`[BetterFloat] No price mapping found for ${buff_name}`);
        helperPrice = 0;
    }

    // we cannot use the getItemPrice function here as it does not return the correct price for doppler skins
    let priceListing = 0;
    let priceOrder = 0;
    if (typeof helperPrice == 'number') {
        priceListing = helperPrice;
        priceOrder = helperPrice;
    } else if (priceMapping[buff_name]) {
        if ((<Skinbaron.SingleItem>item).singleOffer?.dopplerClassName) {
            // does not work yet! example: "doppler-phase4"
            let style = (<Skinbaron.SingleItem>item).singleOffer!.dopplerClassName!.split('-')[1];
            priceListing = priceMapping[buff_name]['buff163']['starting_at']['doppler'][style];
            priceOrder = priceMapping[buff_name]['buff163']['highest_order']['doppler'][style];
        } else {
            priceListing = priceMapping[buff_name]['buff163']['starting_at']['price'];
            priceOrder = priceMapping[buff_name]['buff163']['highest_order']['price'];
        }
    }
    if (priceListing == undefined) {
        priceListing = 0;
    }
    if (priceOrder == undefined) {
        priceOrder = 0;
    }

    // convert prices to user's currency
    // let currencyRate = await getSkbUserCurrencyRate();
    // if (currencyRate != 1) {
    //     priceListing = priceListing / currencyRate;
    //     priceOrder = priceOrder / currencyRate;
    // }

    return { buff_name, priceListing, priceOrder };
}

function createBuffName(item: Skinbaron.Item): string {
    // check if item is a MassItem
    if (Object.keys(item).includes('variant')) {
        return (<Skinbaron.MassItem>item).extendedProductInformation.localizedName;
    }
    const singleItem = item as Skinbaron.SingleItem;
    let buff_name = singleItem.singleOffer.localizedName + (singleItem.singleOffer.localizedExteriorName == 'Not Pained' ? '' : ` (${singleItem.singleOffer.localizedExteriorName})`);
    if (singleItem.singleOffer.statTrakString) {
        buff_name = singleItem.singleOffer.statTrakString + ' ' + buff_name;
    } else if (singleItem.singleOffer.souvenirString) {
        buff_name = singleItem.singleOffer.souvenirString + ' ' + buff_name;
    }
    if (singleItem.singleOffer.localizedVariantTypeName == 'Knife' && !buff_name.startsWith('★')) {
        buff_name = '★ ' + buff_name;
    }
    return buff_name;
}

function getHTMLItemName(container: Element, name_class: string): string {
    return container.querySelector(name_class)?.textContent?.trim() ?? '';
}

function getSkinbaronItem(container: Element): Skinbaron.HTMLItem {
    const isStatTrak = container.querySelector('.badge-danger')?.textContent?.includes('StatTrak') ?? false;
    const type = container.querySelector('.badge-purple')?.textContent?.trim() ?? '';
    let name = container.querySelector('.lName')?.textContent?.trim() ?? '';

    const condition = container.querySelector('.exteriorName')?.textContent?.trim() ?? '';
    const wear = Number(container.querySelector('.wearPercent')?.textContent?.split('%')[0] ?? 0 / 100);

    const getWear = (wear: number) => {
        let wearName = '';
        if (wear < 0.07) {
            wearName = 'Factory New';
        } else if (wear >= 0.07 && wear < 0.15) {
            wearName = 'Minimal Wear';
        } else if (wear >= 0.15 && wear < 0.38) {
            wearName = 'Field-Tested';
        } else if (wear >= 0.38 && wear < 0.45) {
            wearName = 'Well-Worn';
        } else if (wear >= 0.45) {
            wearName = 'Battle-Scarred';
        }
        return wearName;
    };

    const wear_name = getWear(wear);

    const price = Number(container.querySelector('.price')?.textContent?.replace('€', '')?.trim() ?? 0);

    return {
        name: name,
        type: type,
        condition: condition,
        price: price,
        wear: wear,
        wear_name: wear_name,
        isStatTrak: isStatTrak,
    };
}

let extensionSettings: Extension.Settings;
let runtimePublicURL = chrome.runtime.getURL('../public');
// mutation observer active?
let isObserverActive = false;
init();
