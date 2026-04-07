const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // 收集控制台错误
  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(`PAGE_ERROR: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });

  try {
    console.log('=== Step 1: 打开首页 ===');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('首页URL:', page.url());
    console.log('首页标题:', await page.title());

    console.log('\n=== Step 2: 获取可交互元素 ===');
    const btns = await page.$$eval('button, a, [role="button"]', els => 
      els.map(e => ({ tag: e.tagName, text: e.textContent?.trim()?.substring(0, 50), class: e.className?.substring(0, 50) }))
    );
    console.log('找到的按钮/链接:', JSON.stringify(btns, null, 2));

    // 查找公司入口
    console.log('\n=== Step 3: 进入公司 ===');
    // 先尝试找已有的公司链接
    const companyLink = await page.$('a[href*="/company/"], button.company-card');
    if (companyLink) {
      await companyLink.click();
      await page.waitForURL('**/company/**', { timeout: 5000 });
    } else {
      // 尝试查找第一个公司卡片
      const card = await page.$('.company-card');
      if (card) {
        await card.click();
        await page.waitForURL('**/company/**', { timeout: 5000 });
      } else {
        console.log('未找到公司入口，尝试直接访问公司页面...');
        // 先通过 API 获取公司ID
        const apiRes = await page.evaluate(async () => {
          const r = await fetch('/api/companies');
          return await r.json();
        });
        console.log('API 公司列表:', JSON.stringify(apiRes));
        if (apiRes && apiRes.length > 0) {
          await page.goto(`http://localhost:3000/company/${apiRes[0].id}`, { waitUntil: 'networkidle', timeout: 15000 });
        }
      }
    }
    console.log('当前URL:', page.url());

    // 等待页面加载
    await page.waitForTimeout(2000);

    console.log('\n=== Step 4: 导航到招聘页 ===');
    const hireBtn = await page.$('text=招聘');
    if (hireBtn) {
      await hireBtn.click();
      await page.waitForTimeout(1500);
    }
    console.log('当前URL:', page.url());

    console.log('\n=== Step 5: 查找已雇佣员工 ===');
    await page.waitForTimeout(1000);
    const hiredBtns = await page.$$eval('.btn-config', els => els.length);
    console.log(`找到 ${hiredBtns} 个已雇佣员工`);

    if (hiredBtns > 0) {
      console.log('\n=== Step 6: 点击第一个员工的设置按钮 ===');
      // 点击设置按钮 (齿轮图标)
      const configBtn = await page.$('.btn-config');
      if (configBtn) {
        await configBtn.click();
        await page.waitForTimeout(2000);
      }

      console.log('\n=== Step 7: 检查 Modal 是否打开 ===');
      const modal = await page.$('.modal-overlay.config-modal');
      if (modal) {
        console.log('✅ Modal 已打开！');
        
        // 检查 modal 内容
        const modalText = await page.$eval('.modal-overlay.config-modal', el => el.textContent?.substring(0, 200));
        console.log('Modal 内容:', modalText);

        console.log('\n=== Step 8: 切换到各个 Tab ===');
        const tabs = ['MCP 服务器', '技能 Skills', '自优化 AutoAgent'];
        for (const tabText of tabs) {
          const tab = await page.$(`text=${tabText}`);
          if (tab) {
            console.log(`点击 Tab: ${tabText}`);
            await tab.click();
            await page.waitForTimeout(1500);
            
            // 检查是否白屏
            const body = await page.$('body');
            const bodyText = await body.textContent();
            if (bodyText && bodyText.length < 20) {
              console.log(`❌ 白屏！body 内容: "${bodyText}"`);
            } else {
              console.log(`✅ Tab "${tabText}" 正常`);
            }
          }
        }

        console.log('\n=== Step 9: 切回模型配置 Tab ===');
        const modelTab = await page.$('text=模型配置');
        if (modelTab) {
          await modelTab.click();
          await page.waitForTimeout(1000);
        }

        console.log('\n=== Step 10: 保存配置 ===');
        const saveBtn = await page.$('text=保存全部配置');
        if (saveBtn) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          console.log('✅ 已点击保存');
        }

        // 关闭 modal
        const cancelBtn = await page.$('text=取消');
        if (cancelBtn) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
        console.log('✅ Modal 已关闭');
      } else {
        console.log('❌ Modal 未打开');
        // 截图查看当前状态
        await page.screenshot({ path: 'G:\\AIcompany\\debug-no-modal.png' });
        console.log('截图已保存: G:\\AIcompany\\debug-no-modal.png');
      }
    } else {
      console.log('没有已雇佣员工，尝试先雇佣一个...');
      const hireBtn = await page.$('.btn-hire:not(.hired)');
      if (hireBtn) {
        await hireBtn.click();
        await page.waitForTimeout(2000);
        console.log('已点击聘用按钮');
        
        // 再次尝试设置
        const configBtn = await page.$('.btn-config');
        if (configBtn) {
          console.log('\n=== 聘用后点击设置 ===');
          await configBtn.click();
          await page.waitForTimeout(2000);
          const modal = await page.$('.modal-overlay.config-modal');
          console.log(modal ? '✅ Modal 已打开' : '❌ Modal 未打开');
        }
      }
    }

    console.log('\n=== 最终错误检查 ===');
    if (errors.length === 0) {
      console.log('✅ 没有控制台错误！');
    } else {
      console.log(`❌ 发现 ${errors.length} 个错误:`);
      errors.forEach(e => console.log('  -', e));
    }

    // 截图最终状态
    await page.screenshot({ path: 'G:\\AIcompany\\debug-final.png' });
    console.log('\n最终截图已保存: G:\\AIcompany\\debug-final.png');

  } catch (err) {
    console.error('测试出错:', err.message);
    await page.screenshot({ path: 'G:\\AIcompany\\debug-error.png' });
    console.log('错误截图: G:\\AIcompany\\debug-error.png');
  }

  // 保持浏览器打开 5 秒
  await page.waitForTimeout(5000);
  await browser.close();
  console.log('\n测试完成');
})();
