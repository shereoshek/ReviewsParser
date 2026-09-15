import puppeteer from 'puppeteer';

const url = process.argv[2];
const MAX_REVIEWS = 600;

if (!url) {
    console.error('URL is required');
    process.exit(1);
}

console.log(`Parsing: ${url}`);

let browser;

try {
    browser = await puppeteer.launch({
        headless: true,
    });

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

    // Открываем карточку организации
    await page.goto(url, {
        waitUntil: 'networkidle2',
    });

    console.log('Final URL:', page.url());
    console.log('Title:', await page.title());

    // Получаем данные организации
    const organization = await page.evaluate(() => {
        const nameElement = document.querySelector(
            '.search-placemark-title__title-text'
        );

        const ratingElement = document.querySelector(
            '.search-placemark-title-modular-hint-view__rating'
        );

        const ratingsCountElement = document.querySelector(
            '.business-header-rating-view__text'
        );

        const reviewsLinkElement = [...document.querySelectorAll('a')]
            .find(link => link.textContent?.trim() === 'Отзывы');

        return {
            name: nameElement?.textContent?.trim() ?? null,
            rating: ratingElement?.textContent?.trim() ?? null,
            ratingsCount: ratingsCountElement?.textContent?.trim() ?? null,
            reviewsUrl: reviewsLinkElement?.href ?? null,
        };
    });

    console.log('Organization:', organization);

    // Переходим на страницу отзывов
    if (!organization.reviewsUrl) {
        throw new Error(
            'Reviews URL was not found on the organization page'
        );
    }

    await page.goto(organization.reviewsUrl, {
        waitUntil: 'networkidle2',
    });

    console.log('Reviews page:', page.url());

    let reviewsCount = 0;

    while (reviewsCount < MAX_REVIEWS) {
        reviewsCount = await page.evaluate(() => {
            return document.querySelectorAll(
                '.business-reviews-card-view__review'
            ).length;
        });

        console.log(`Reviews loaded: ${reviewsCount}`);

        if (reviewsCount >= MAX_REVIEWS) {
            break;
        }

        const previousCount = reviewsCount;

        // Прокручиваем настоящий scroll-контейнер Яндекса
        await page.evaluate(() => {
            const scrollContainer = document.querySelector(
                '.scroll__container'
            );

            if (!scrollContainer) {
                throw new Error(
                    'Reviews scroll container was not found'
                );
            }

            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth',
            });
        });

        // Ждём появления новых отзывов
        try {
            await page.waitForFunction(
                (previousCount) => {
                    const currentCount = document.querySelectorAll(
                        '.business-reviews-card-view__review'
                    ).length;

                    return currentCount > previousCount;
                },
                {
                    timeout: 8000,
                },
                previousCount
            );
        } catch {
            console.log(
                'No new reviews loaded. Stopping.'
            );

            break;
        }

        // Получаем новое количество
        reviewsCount = await page.evaluate(() => {
            return document.querySelectorAll(
                '.business-reviews-card-view__review'
            ).length;
        });

        console.log(`Reviews loaded: ${reviewsCount}`);
    }

    console.log(
        'Total reviews loaded:',
        Math.min(reviewsCount, MAX_REVIEWS)
    );

    const reviewsToProcess = Math.min(
        reviewsCount,
        MAX_REVIEWS
    );

    for (let index = 0; index < reviewsToProcess; index++) {
        const result = await page.evaluate((index) => {
            const reviews = document.querySelectorAll(
                '.business-reviews-card-view__review'
            );

            const review = reviews[index];

            if (!review) {
                return {
                    success: false,
                    error: `Review ${index + 1} not found`,
                };
            }

            const expandButton = review.querySelector(
                '.business-review-view__expand'
            );

            if (!expandButton) {
                return {
                    success: true,
                    expanded: false,
                };
            }

            expandButton.click();

            return {
                success: true,
                expanded: true,
            };
        }, index);

        if (!result.success) {
            console.log(
                `Review ${index + 1}: ERROR — ${result.error}`
            );

            continue;
        }

        if (result.expanded) {
            try {
                await page.waitForFunction(
                    (index) => {
                        const reviews = document.querySelectorAll(
                            '.business-reviews-card-view__review'
                        );

                        const review = reviews[index];

                        return !review?.querySelector(
                            '.business-review-view__expand'
                        );
                    },
                    {
                        timeout: 3000,
                    },
                    index
                );
            } catch {
                console.log(
                    `Review ${index + 1}: expansion timeout`
                );

                continue;
            }

            console.log(
                `Review ${index + 1}: expanded`
            );
        } else {
            console.log(
                `Review ${index + 1}: no expansion needed`
            );
        }
    }

    const reviews = await page.evaluate((maxReviews) => {
        const reviewElements = [
            ...document.querySelectorAll(
                '.business-reviews-card-view__review'
            ),
        ].slice(0, maxReviews);

        return reviewElements.map((reviewElement) => ({
            author: reviewElement
                .querySelector(
                    '.business-review-view__author-name'
                )
                ?.textContent
                ?.trim() ?? null,

            rating: reviewElement
                .querySelector(
                    '[itemprop="ratingValue"]'
                )
                ?.getAttribute('content') ?? null,

            publishedAt: reviewElement
                .querySelector(
                    '[itemprop="datePublished"]'
                )
                ?.getAttribute('content') ?? null,

            text: reviewElement
                .querySelector(
                    '.spoiler-view__text-container'
                )
                ?.textContent
                ?.trim() ?? null,
        }));
    }, MAX_REVIEWS);

    console.log(
        'Reviews parsed:',
        reviews.length
    );

    console.log(
        'First review:',
        reviews[0]
    );

    console.log(
        'Last review:',
        reviews[reviews.length - 1]
    );

} catch (error) {
    console.error(
        'Parser error:',
        error.message
    );

    process.exitCode = 1;

} finally {
    if (browser) {
        await browser.close();
    }
}