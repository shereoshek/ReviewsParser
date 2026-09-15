import puppeteer from 'puppeteer';

const inputUrl = process.argv[2];

if (!inputUrl) {
    throw new Error('Yandex Maps URL is required.');
}

const MAX_REVIEWS = 600;
const MAX_NO_PROGRESS_ATTEMPTS = 3;
const LOAD_WAIT_TIMEOUT = 10000;

const browser = await puppeteer.launch({
    headless: true,
});

try {
    const page = await browser.newPage();

    await page.setViewport({
        width: 1920,
        height: 1080,
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/140.0.0.0 Safari/537.36'
    );

    console.error(`Parsing: ${inputUrl}`);

    await page.goto(inputUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
    });

    console.error(`Final URL: ${page.url()}`);
    console.error(`Title: ${await page.title()}`);

    /*
     * Получаем основные данные организации.
     */
    const organization = await page.evaluate(() => {
        const nameElement = document.querySelector(
            '.search-placemark-title__title-text'
        );

        /*
         * Yandex Maps может использовать разные элементы
         * для отображения рейтинга.
         *
         * Первый селектор — старый вариант.
         * Второй — актуальный вариант.
         */
        const ratingElement =
            document.querySelector(
                '.search-placemark-title-modular-hint-view__rating'
            ) ??
            document.querySelector(
                '.business-rating-badge-view__rating-text'
            );

        const ratingsCountElement = document.querySelector(
            '.business-header-rating-view__text'
        );

        const reviewsLinkElement = [...document.querySelectorAll('a')]
            .find(link => link.textContent?.trim() === 'Отзывы');

        const reviewsUrl = reviewsLinkElement?.href ?? null;

        const externalId = reviewsUrl?.match(
            /\/org\/[^/]+\/(\d+)\/reviews/
        )?.[1] ?? null;

        return {
            externalId,
            name: nameElement?.textContent?.trim() ?? null,
            rating: ratingElement?.textContent?.trim() ?? null,
            ratingsCount: ratingsCountElement?.textContent?.trim() ?? null,
            reviewsUrl,
        };
    });

    /*
     * Проверяем основные данные организации.
     */
    if (!organization.name) {
        throw new Error(
            'Organization name was not found. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    if (!organization.reviewsUrl) {
        throw new Error(
            'Reviews URL was not found. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    if (!organization.externalId) {
        throw new Error(
            'Organization external ID was not found. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    /*
     * Рейтинг может отсутствовать, если у организации
     * ещё нет оценок.
     */
    if (organization.rating) {
        organization.rating = Number(
            organization.rating.replace(',', '.')
        );

        if (
            !Number.isFinite(organization.rating) ||
            organization.rating < 0 ||
            organization.rating > 5
        ) {
            throw new Error(
                'Organization rating has an invalid value.'
            );
        }
    } else {
        organization.rating = null;
    }

    /*
     * Количество оценок.
     */
    if (!organization.ratingsCount) {
        throw new Error(
            'Organization ratings count was not found. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    organization.ratingsCount = Number(
        organization.ratingsCount.replace(/\D/g, '')
    );

    if (
        !Number.isInteger(organization.ratingsCount) ||
        organization.ratingsCount < 0
    ) {
        throw new Error(
            'Organization ratings count has an invalid value.'
        );
    }

    /*
     * Если оценки у организации есть, но сам рейтинг
     * не найден, считаем это проблемой разметки.
     *
     * Это лучше, чем молча сохранить rating = null
     * и получить неполные данные.
     */
    if (
        organization.ratingsCount > 0 &&
        organization.rating === null
    ) {
        throw new Error(
            'Organization rating was not found, ' +
            'although ratings count is greater than zero. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    console.error('Organization:', organization);

    /*
     * Переходим на страницу отзывов.
     */
    await page.goto(organization.reviewsUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
    });

    console.error(`Reviews page: ${page.url()}`);

    /*
     * Получаем точное количество отзывов.
     */
    const reviewsTotal = await page.evaluate(() => {
        const reviewsLabel = [...document.querySelectorAll(
            '.tabs-select-view__label'
        )].find(
            element => element.textContent?.trim() === 'Отзывы'
        );

        if (!reviewsLabel) {
            return null;
        }

        let container = reviewsLabel.parentElement;

        while (container) {
            const counter = container.querySelector(
                '.tabs-select-view__counter'
            );

            if (counter) {
                const value = counter.textContent?.trim();

                if (value) {
                    return Number(
                        value.replace(/\s/g, '')
                    );
                }
            }

            container = container.parentElement;
        }

        return null;
    });

    if (
        !Number.isInteger(reviewsTotal) ||
        reviewsTotal < 0
    ) {
        throw new Error(
            'Reviews count was not found or has an invalid value. ' +
            'Yandex Maps layout may have changed.'
        );
    }

    organization.reviewsCount = reviewsTotal;

    console.error(`Reviews total: ${reviewsTotal}`);

    /*
     * Загружаем отзывы.
     */
    let reviewsLoaded = 0;
    let noProgressAttempts = 0;

    while (true) {
        const reviewsCount = await page.evaluate(() => {
            return document.querySelectorAll(
                '.business-reviews-card-view__review'
            ).length;
        });

        /*
         * Достигли максимального количества отзывов.
         */
        if (reviewsCount >= MAX_REVIEWS) {
            console.error('Maximum review limit reached.');
            break;
        }

        /*
         * Все доступные отзывы уже загружены.
         */
        if (reviewsCount >= organization.reviewsCount) {
            console.error('All available reviews loaded.');
            break;
        }

        /*
         * Прокручиваем контейнер отзывов вниз.
         */
        await page.evaluate(() => {
            const container = document.querySelector(
                '.scroll__container'
            );

            if (!container) {
                throw new Error(
                    'Reviews scroll container was not found. ' +
                    'Yandex Maps layout may have changed.'
                );
            }

            container.scrollTop = container.scrollHeight;
        });

        try {
            /*
             * Ждём появления новых карточек.
             */
            await page.waitForFunction(
                previousCount => {
                    const currentCount =
                        document.querySelectorAll(
                            '.business-reviews-card-view__review'
                        ).length;

                    return currentCount > previousCount;
                },
                {
                    timeout: LOAD_WAIT_TIMEOUT,
                },
                reviewsCount
            );

            const newReviewsCount = await page.evaluate(() => {
                return document.querySelectorAll(
                    '.business-reviews-card-view__review'
                ).length;
            });

            if (newReviewsCount < MAX_REVIEWS) {
                console.error(
                    `Reviews loaded: ${newReviewsCount}`
                );
            }

            noProgressAttempts = 0;
        } catch {
            /*
             * Проверяем, не появились ли отзывы
             * непосредственно перед окончанием ожидания.
             */
            const currentReviewsCount = await page.evaluate(() => {
                return document.querySelectorAll(
                    '.business-reviews-card-view__review'
                ).length;
            });

            if (currentReviewsCount > reviewsCount) {
                if (currentReviewsCount < MAX_REVIEWS) {
                    console.error(
                        `Reviews loaded: ${currentReviewsCount}`
                    );
                }

                noProgressAttempts = 0;

                continue;
            }

            noProgressAttempts++;

            console.error(
                `No new reviews loaded. ` +
                `Attempt ${noProgressAttempts}/` +
                `${MAX_NO_PROGRESS_ATTEMPTS}.`
            );

            /*
             * После нескольких последовательных
             * безрезультатных попыток прекращаем загрузку.
             */
            if (
                noProgressAttempts >=
                MAX_NO_PROGRESS_ATTEMPTS
            ) {
                break;
            }
        }
    }

    /*
     * Получаем итоговое количество карточек.
     */
    reviewsLoaded = await page.evaluate(() => {
        return document.querySelectorAll(
            '.business-reviews-card-view__review'
        ).length;
    });

    console.error(`Total reviews loaded: ${reviewsLoaded}`);

    /*
     * Проверяем пустой ответ.
     */
    if (
        organization.reviewsCount > 0 &&
        reviewsLoaded === 0
    ) {
        throw new Error(
            'Reviews page returned an empty response.'
        );
    }

    /*
     * Если отзывов должно быть меньше либо равно 600,
     * должны загрузиться все.
     */
    if (
        organization.reviewsCount <= MAX_REVIEWS &&
        reviewsLoaded !== organization.reviewsCount
    ) {
        throw new Error(
            `Expected ${organization.reviewsCount} reviews, ` +
            `but only ${reviewsLoaded} were loaded.`
        );
    }

    /*
     * Если отзывов больше 600,
     * должны загрузиться ровно 600.
     */
    if (
        organization.reviewsCount > MAX_REVIEWS &&
        reviewsLoaded !== MAX_REVIEWS
    ) {
        throw new Error(
            `Expected to load ${MAX_REVIEWS} reviews, ` +
            `but only ${reviewsLoaded} were loaded.`
        );
    }

    /*
     * Раскрываем длинные отзывы.
     */
    const reviewElements = await page.$$(
        '.business-reviews-card-view__review'
    );

    for (const reviewElement of reviewElements) {
        const expandButton = await reviewElement.$(
            '.business-review-view__expand'
        );

        if (expandButton) {
            await expandButton.click();

            await page.waitForFunction(
                element => {
                    const textElement = element.querySelector(
                        '.spoiler-view__text-container'
                    );

                    return textElement &&
                        textElement.textContent?.trim();
                },
                {
                    timeout: 3000,
                },
                reviewElement
            );
        }
    }

    /*
     * Извлекаем данные отзывов.
     */
    const reviews = await page.evaluate(() => {
        return [...document.querySelectorAll(
            '.business-reviews-card-view__review'
        )].map(reviewElement => ({
            author:
                reviewElement
                    .querySelector(
                        '.business-review-view__author-name'
                    )
                    ?.textContent
                    ?.trim() ?? null,

            rating:
                reviewElement
                    .querySelector(
                        '[itemprop="ratingValue"]'
                    )
                    ?.getAttribute('content') ?? null,

            publishedAt:
                reviewElement
                    .querySelector(
                        '[itemprop="datePublished"]'
                    )
                    ?.getAttribute('content') ?? null,

            text:
                reviewElement
                    .querySelector(
                        '.spoiler-view__text-container'
                    )
                    ?.textContent
                    ?.trim() ?? null,
        }));
    });

    /*
     * Проверяем каждый отзыв.
     */
    for (let index = 0; index < reviews.length; index++) {
        const review = reviews[index];

        if (!review.author) {
            throw new Error(
                `Review #${index + 1}: author was not found. ` +
                'Yandex Maps layout may have changed.'
            );
        }

        if (!review.rating) {
            throw new Error(
                `Review #${index + 1}: rating was not found. ` +
                'Yandex Maps layout may have changed.'
            );
        }

        if (!review.publishedAt) {
            throw new Error(
                `Review #${index + 1}: publication date was not found. ` +
                'Yandex Maps layout may have changed.'
            );
        }

        if (!review.text) {
            throw new Error(
                `Review #${index + 1}: text was not found. ` +
                'Yandex Maps layout may have changed.'
            );
        }

        const rating = Number(review.rating);

        if (
            !Number.isFinite(rating) ||
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            throw new Error(
                `Review #${index + 1}: invalid rating "${review.rating}".`
            );
        }

        review.rating = rating;
    }

    /*
     * Проверяем количество распарсенных отзывов.
     */
    if (reviews.length !== reviewsLoaded) {
        throw new Error(
            `Expected ${reviewsLoaded} parsed reviews, ` +
            `but received ${reviews.length}.`
        );
    }

    console.error(`Reviews parsed: ${reviews.length}`);

    if (reviews.length > 0) {
        console.error('First review:', reviews[0]);
        console.error('Last review:', reviews[reviews.length - 1]);
    }

    /*
     * Формируем итоговый JSON.
     *
     * В stdout выводится только JSON.
     * Все диагностические сообщения идут в stderr.
     */
    console.log(JSON.stringify({
        organization: {
            externalId: organization.externalId,
            name: organization.name,
            rating: organization.rating,
            ratingsCount: organization.ratingsCount,
            reviewsCount: organization.reviewsCount,
        },
        reviews,
    }, null, 2));
} catch (error) {
    console.error(`Parser error: ${error.message}`);

    process.exitCode = 1;
} finally {
    await browser.close();
}