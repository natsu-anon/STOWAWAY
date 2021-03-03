function channelSelect (cli, db, client) {
	return function (box, scroll, scrollIndex, scrollHeight)  {
		box.setContent("loading available channels...");
		box.setLabel(" Choose a channel to connect to; [W] and [S] to navigate, [ENTER] to continue ");
		return new Promise((resolve, reject) => {
			db.findOne({ last_channel: { $exists: true }}, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				const content = [];
				const ids = [];
				let p;
				if (doc != null) {
					p = client.channels.fetch(doc.last_channel)
					.then((channel) => {
						content.push(`PREVIOUSLY: ${channel.guild.name} {green-fg}#${channel.name}{/}`);
						ids.push(channel.id);
					});
				}
				else {
					p = Promise.resolve();
				}
				p.then(() => {
					client.guilds.cache.each(guild => {
						guild.channels.cache.filter(channel => channel.isText())
						.each(channel => {
							content.push(`${guild.name} {green-fg}#${channel.name}{/}`);
							ids.push(channel.id);
						});
					});
				})
				.then(() => {
					if (ids.length == 0) {
						throw new Error("No channels available :(  Make sure to add your bot to some servers!\nSee: github.com/natsu-anon/STOWAWAY#add-your-bot-to-a-server for more information");
					}
				})
				.then(() => {
					index = 0;
					const display = (selected) => {
						let res = '';
						let halfHeight = Math.floor(box.actualHeight / 2);
						if (box.actualHeight <= 1) {
							res = `> {inverse}${content[selected]}{/}`;
						}
						if (ids.length > box.actualHeight) {
							 if (selected <= halfHeight) {
								for (let i = 0; i < box.actualHeight; i++) {
									if (i == selected) {
										res += `> {inverse}${content[i]}{/}\n`
									}
									else {
										res += `${content[i]}\n`;
									}
								}
							}
							else if (selected >= ids.length - halfHeight) {
								for (let i = ids.length - box.actualHeight; i < ids.length; i++) {
									if (i == selected) {
										res += `> {inverse}${content[i]}{/}\n`
									}
									else {
										res += `${content[i]}\n`;
									}
								}
							}
							else {
								for (let i = selected - halfHeight; i <= selected + halfHeight; i++) {
									if (i == selected) {
										res += `> {inverse}${content[i]}{/}\n`
									}
									else {
										res += `${content[i]}\n`;
									}
								}
							}
						}
						else {
							for (let i = 0; i < content.length; i++) {
								if (i == selected) {
									res += `> {inverse}${content[i]}{/}\n`
								}
								else {
									res += `${content[i]}\n`;
								}
							}
						}
						return res;
					};
					/*
					const maybeScroll = function (line) {
						if (box.actualHeight < content.length) {
							if (line < scrollIndex()) {
								scroll(-1);
							}
							else if (line > box.scrollIndex() + scrollHeight()) {
								scroll(1);
							}
						}
					};
					*/
					// getScrollIndex();
					// throw Error(Object.getOwnPropertyNames(box));
					box.setContent(display(index));
					cli.render();
					box.on('resize', () => {
						box.setContent(display(index));
						cli.render();
					});
					box.key(['w'], () => {
						if (--index < 0) {
							index = 0;
						}
						box.setContent(display(index));
						// maybeScroll(index);
						cli.render();
					});
					box.key(['s'], () => {
						if (++index > ids.length - 1) {
							index = ids.length - 1;
						}
						box.setContent(display(index));
						// maybeScroll(index);
						cli.render();
					});
					box.key(['enter'], () => {
						if (doc != null) {
							db.update({ last_channel: { $exists: true }}, { $set: { last_channel: ids[index] }});
						}
						else {
							db.insert({ last_channel: ids[index] });
						}
						resolve(ids[index]);
					});
				})
				.catch(reject);
			});
		});
	};
}

module.exports = channelSelect;
