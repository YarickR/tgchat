$(function() {

    var chats = [];
    var search_term;
    var user_mask;
    var chatgroup_mask;
    var prevScrollPosition = -1;

    /*

    [{
        chat_id: 123,
        chatName: 'chat name',
        lastMessageId: 123,
        isEnded: false, // показывает загружать ли еще сообщения или уже достигнут конец
        messages: [
            {
                text: 'Text messages',
                author: 'Yaroslav 2',
                time: '12:01',
                messageId: 12
            },
            {
                text: 'Text messages',
                author: 'Yaroslav',
                time: '12:02',
                messageId: 13
            }
        ]
    },{
        ...
    }]

    */

    function getChatIndexById(chatId) {
        /*
        возвращаем index чата в массиве чатов по полученному chatId
        */

        var retVal = -1;
        chats.forEach(function(item, index) {
            if (item.chat_id === chatId) {
                retVal = index;
            }
        });
        return retVal;    }

    function getMessageIndexByChatIdAndMessageId(chatId, messageId) {
        /*
         возвращаем index сообщения по его id и chat id
        */
        var chatIndex = getChatIndexById(chatId);
        if (chatIndex === -1) {
            return -1;
        }

        var retVal = -1;
        chats[chatIndex].messages.forEach(function(item, index) {
            if (item.messageId === messageId) {
                retVal = index;
            }
        });
        return retVal;
    }

    function getCountDays(ts) {
        var date = new Date(ts*1000);
        var now = new Date();

        var diff = now - date;

        return Math.floor(diff / 86400000);
    }

    function getFormattedDate(ts) {
        /*
        возвращаем отформатированную дату по входному timestamp
        */

        // преобразовываем дату/время в объект
        var date = new Date(ts*1000);

        // закидываем компоненты даты/времени в массив для обработки
        var retVal = [date.getHours(), date.getMinutes(), date.getDate(), date.getMonth()+1, date.getFullYear()]

        // преобразовываем компоненты даты/времени в строки
        retVal.forEach(function(item, index) {
            var cur = item;
            if (item < 10) cur = '0' + item;
            else cur = item + '';
            retVal[index] = cur;
        });

        /*
            retVal[0] - часы
            retVal[1] - минуты
            retVal[2] - дата(день) 1-31
            retVal[3] - месяц 1-12
            retVal[4] - год 201*
        */

        return retVal[0] + ":" + retVal[1] + " " + retVal[2] + "." + retVal[3] + "." + retVal[4];
    }

    function getFormattedTime(ts) {
        /*
        возвращаем отформатированную дату по входному timestamp
        */

        // преобразовываем дату/время в объект
        var date = new Date(ts*1000);

        // закидываем компоненты даты/времени в массив для обработки
        var retVal = [date.getHours(), date.getMinutes(), date.getDate(), date.getMonth()+1, date.getFullYear()]

        // преобразовываем компоненты даты/времени в строки
        retVal.forEach(function(item, index) {
            var cur = item;
            if (item < 10) cur = '0' + item;
            else cur = item + '';
            retVal[index] = cur;
        });

        /*
            retVal[0] - часы
            retVal[1] - минуты
            retVal[2] - дата(день) 1-31
            retVal[3] - месяц 1-12
            retVal[4] - год 201*
        */

        return retVal[0] + ":" + retVal[1];
    }

    function getFormattedDateWithoutTime(ts) {
        /*
        возвращаем отформатированную дату по входному timestamp
        */

        // преобразовываем дату/время в объект
        var date = new Date(ts*1000);

        // закидываем компоненты даты/времени в массив для обработки
        var retVal = [date.getHours(), date.getMinutes(), date.getDate(), date.getMonth()+1, date.getFullYear()]

        // преобразовываем компоненты даты/времени в строки
        retVal.forEach(function(item, index) {
            var cur = item;
            if (item < 10) cur = '0' + item;
            else cur = item + '';
            retVal[index] = cur;
        });

        /*
            retVal[0] - часы
            retVal[1] - минуты
            retVal[2] - дата(день) 1-31
            retVal[3] - месяц 1-12
            retVal[4] - год 201*
        */

        return retVal[2] + "." + retVal[3] + "." + retVal[4];
    }

    function selectChatText(text, phrase) {
        /*
        выделяем в сообщении поисковую фразу
        */

        // регулярное выражение
        var re = new RegExp(phrase,"gi");

        // получаем новую строку с html тегами span.select поисковых фраз
        var retVal = text.replace(re, "<span class='select'>$&</span>");

        return retVal;
    }

    function endOfChat(chatId) {
        /*
        обрабатываем конец чата (вставляем сообщение)
        */

        var template = $('#chat-end').html();

        var html = Mustache.to_html(template, {
            text: "Конец сообщений"
        });

        $('.chat-id-' + chatId + ' .chat__messages-wrap').append(html);
    }

    function getHtmlDateWithoutTime(ts) {
        var template = $('#chat-date').html();
        var html = Mustache.to_html(template, {
            formattedDate: getFormattedDateWithoutTime(ts)
        });

        return html;
    }

    function renderMessages(chatId, messages) {
        var chatIndex = getChatIndexById(chatId);
        var html = '';

        var prev_message = {};

        // генерируем prev сообщение по разметке
        if ($('.chat-id-'+chatId+' .message-wrap').length > 0) {

            // получаем из html id последнего сгенированного сообщения
            var msgId = parseInt($('.chat-id-'+chatId+' .message-wrap').last().attr("data-msg-id"));
            // получаем из chats[chatIndex].messages сообщение по его id
            var cur_msg = chats[chatIndex].messages[getMessageIndexByChatIdAndMessageId(chatId, msgId)];

            // сохраняем его в prev_message
            prev_message = {
                text: cur_msg.text,
                author: cur_msg.author,
                time: cur_msg.time,
                messageId: cur_msg.messageId
            }

        } else { // если сообщений нет совсем
            prev_message = {
                text: messages[0].text,
                author: "",
                time: 1,
                messageId: messages[0].messageId
            }
        }



        messages.forEach(function(item, index) {
            /*var data = {
                text: item.text,
                author: item.author,
                time: item.time,
                chatId: chatId,
                messageId: item.messageId
            };*/

            /*
            Рассмотрим 3 случая генерации сообщения:
                (сравниваем текущее и предыдущее сообщения)
            - если кол-во дней до сегодня разное =>
                => ставим дату и рендерим нормальное сообщение
            - если кол-во дней до сегодня одинаковое && авторы одинаковые =>
                => рендерим сообщение без автора
            - если кол-во дней до сегодня одинаковое && авторы разные =>
                => рендерим нормальное сообщение
            */

            //console.log(prev_message, item);

            var curCountDays = getCountDays(item.time);
            var prevCountDays = getCountDays(prev_message.time);
            if (curCountDays !== prevCountDays) {
                html += getHtmlDateWithoutTime(item.time);

                var template = $('#message-template').html();
                html += Mustache.to_html(template, {
                    chatId: chatId,
                    messageId: item.messageId,
                    author: item.author,
                    text: item.text,
                    time: getFormattedTime(item.time)
                });
            } else if (curCountDays === prevCountDays &&
                        item.author === prev_message.author) {
                var template = $('#message-template-without-author').html();
                html += Mustache.to_html(template, {
                    chatId: chatId,
                    messageId: item.messageId,
                    text: item.text,
                    time: getFormattedTime(item.time)
                });
            } else if (curCountDays === prevCountDays &&
                        item.author !== prev_message.author) {
                var template = $('#message-template').html();
                html += Mustache.to_html(template, {
                    chatId: chatId,
                    messageId: item.messageId,
                    author: item.author,
                    text: item.text,
                    time: getFormattedTime(item.time)
                });
            }

            /*prev_message = {
                text: item.text,
                author: item.author,
                time: item.time,
                messageId: item.messageId
            };*/
            prev_message = item;

        });

        //console.log(html);
        $('.chat-id-' + chatId + ' .chat__messages-wrap').append(html);
    }

    function loadMessagesForChat(chatId) {
        /*
        загружаем сообщения в чат по его chatId
        */

        var chatIndex = getChatIndexById(chatId);

        // если сообщений больше нет, то ajax запрос не посылаем
        if (chats[chatIndex].isEnded) return;


        // запускаем ajax звпрос
        $.ajax({
            url: "api/get_msgs/",
            data: {
                "search_term": search_term || '.*',
                "chatgroup_mask": chats[chatIndex].chatName,
                "start_msgid": chats[chatIndex].lastMessageId,
                "user_mask": user_mask || '.*'
            },
            type: "POST",
            dataType: "json",
            success: function(data) {
                // console.log('данные для чата получены', data);

                /*
                - если размер полученного массива <= 1,
                    то сообщений нет и больше в этом чате не будет
                - если размер полученного массива > 1 && < 100 =>
                    сообщения пришли и их надо обработать, но после них больше сообщений нет
                */

                if (data.length <= 1) { // сообщений больше нет
                    chats[chatIndex].isEnded = true;
                    endOfChat(chatId);
                } else { //есть еще сообщения

                    // генерируем массив сообщений
                    var messages = [];
                    data.forEach(function(item, index) {
                        var cur_message = {
                            text: selectChatText(item.contents, search_term),
                            author: item.sender_name,
                            time: item.ts,
                            messageId: item.msgid
                        };
                        messages.push(cur_message);
                    });
                    chats[chatIndex].lastMessageId = messages[messages.length - 1].messageId;

                    // рендерим сообщения
                    messages.splice(0, 1); // удаляем первое сообщение(иначе - будет дублироваться)
                    chats[chatIndex].messages = chats[chatIndex].messages.concat(messages);
                    messages.forEach(function(itemMessage, index) {
                        var template = $('#message-template').html();

                        var data = {
                            text: itemMessage.text,
                            author: itemMessage.author,
                            time: itemMessage.time,
                            leftRightClass: itemMessage.leftRightClass,
                            chatId: chatId,
                            messageId: itemMessage.messageId
                        };
                        var html = Mustache.to_html(template, data);

                        //$('.chat-id-' + chatId + ' .chat__messages-wrap').append(html);
                    });

                    console.log(renderMessages(chatId, messages));


                    // проверяем есть ли сообщения еще
                    if (data.length < 100) {
                        chats[chatIndex].isEnded = true;
                        endOfChat(chatId);
                    }
                }
            },
            error: function( req, status, err ) {
                alert('ERROR getting json messages for chat: '+ status);
            }
        });
    }

    function chatSelect(chatId) {
        // убираем предыдущий обработчик scroll-а чата
        $('.js-chat .chat__messages').off('scroll');

        // догрузка сообщений для чата
        loadMessagesForChat(chatId);

        // listener on scroll
        scrollListener = '.js-chat.chat-id-'+chatId+' .chat__messages';
        $('.js-chat.chat-id-'+chatId+' .chat__messages').on('scroll', function() {
            /*
            при обычной обработке on scroll события callback вызывается не один раз(2 и больше)
            для предотвращения этого заводим глобальную переменную prevScrollPosition, где
            будем хранить предыдущую позицию срабатывания on scroll в конце чата =>
            при повторном вызове callback-а:
            - если в этой позиции callback уже вызывался, то мы ничего не делаем
            - иначе => чат первый раз пролистался до этого конца
            */

            var scrollPosition = $(this).scrollTop() + $(this).height() - 10;

            if (scrollPosition === $(this).find('.chat__messages-wrap').height()) {
                //console.log('hello1');
                if (prevScrollPosition === scrollPosition) {
                    return;
                } else {
                    prevScrollPosition = scrollPosition;
                }

                loadMessagesForChat(chatId);
            }
        });
    }


    /*
    listener при клике на чат: $(document).on('event', 'selector on objects', callback)
    обрабатывает объекты, созданные после создания listener-а
    (то есть при создании объекта не надо на него вешать listener)
    */
    $(document).on("click", ".js-chat-list-item", function() {
        // парсим из html id чата
        var chatId = parseInt($(this).attr("data-chat-id"));

        // css свойства для выделения активного чата
            //удаление active класса со всех чатов
            $(".js-chat-list-item").removeClass("active");
            $(this).addClass("active");
            // добавление active класса текущему чату
            $(".js-chat").removeClass("active");
            $(".js-chat.chat-id-"+chatId).addClass("active");

        // догрузка сообщений
        chatSelect(chatId);
    });


    function makeFirstAjax(dataObj) {
        $.ajax({
            url: "api/get_msgs/",
            data: dataObj,
            type: "POST",
            dataType: "json",
            success: function(data) {
                //console.log('данные получены', data);

                data.forEach(function(item, index) {
                    //добавляем сообщение к нужному чату

                    /* формат пришедших данных
                        item = {
                            chatgroup_id: 1116881062,
                            chatgroup_name: "A1/A1EU - dev/QA/magic",
                            contents: "пример сообщения",
                            msgid: 19,
                            sender_id: 276687073,
                            sender_name: "Andrey Polosin",
                            sender_username: "mehabyte",
                            ts: 1516087153
                        }
                    */

                    var curChatIndex = getChatIndexById(item.chatgroup_id);
                    var cur_message = {
                        text: selectChatText(item.contents, search_term),
                        author: item.sender_name,
                        time: item.ts,
                        messageId: item.msgid
                    };
                    if ( curChatIndex > -1 ) { //если такой чат уже существует
                        chats[curChatIndex].messages.push(cur_message);
                        chats[curChatIndex].lastMessageId = item.msgid;
                    } else { //такого чата еще нет
                        chats.push({
                            chat_id: item.chatgroup_id,
                            chatName: item.chatgroup_name,
                            lastMessageId: item.msgid,
                            isEnded: false,
                            messages: [cur_message]
                        });
                    }

                });

                //render html
                chats.forEach(function(itemChat, index) {
                    //генерируем чат в списке чатов
                    var template = $('#chat-list').html();
                    var html = Mustache.to_html(template, {
                        chatId: itemChat.chat_id,
                        chatName: itemChat.chatName,
                        lastMessage: itemChat.lastMessage
                    });
                    $('.chats-list-wrap').append(html);


                    //генерируем вкладку для сообщений
                    var template = $('#chat').html();
                    var html = Mustache.to_html(template, {
                        chatName: itemChat.chatName,
                        chatId: itemChat.chat_id
                    });
                    $(".content-right").append(html);

                    //генерируем сообщения во вкладках сообщений
                    /*itemChat.messages.forEach(function(itemMessage, index) {
                        var template = $('#message-template').html();

                        var data = {
                            text: itemMessage.text,
                            author: itemMessage.author,
                            time: itemMessage.time,
                            leftRightClass: itemMessage.leftRightClass,
                            chatId: itemChat.chat_id,
                            messageId: itemMessage.messageId
                        };
                        var html = Mustache.to_html(template, data);

                        $('.chat-id-' + itemChat.chat_id + ' .chat__messages-wrap').append(html);

                    });*/
                    renderMessages(itemChat.chat_id, itemChat.messages);
                });

                // console.log('chats after first ajax: ', chats);

            },
            error: function( req, status, err ) {
                alert('ERROR getting json messages: '+ status);
            }
        });
    }

    // форма поиска
    $('.search-form').on('submit', function(e) {
        e.preventDefault();

        // поисковая фраза
        search_term = $(this).find('.search-term').val().toLowerCase();
        user_mask = $(this).find('.search-user').val();
        chatgroup_mask = $(this).find('.search-chat').val();

        // очищаем все предыдущие данные
        chats = [];
        prevScrollPosition = -1;
        $('.chats-list-wrap').html('');
        $(".content-right").html('');

        // выполняем запрос
        makeFirstAjax({
            search_term: search_term || '.*',
            user_mask: user_mask || '.*',
            selected_groups: {},
            chatgroup_mask: chatgroup_mask || '.*'
        });
    });

    $('input.search-chat').autocomplete({
        serviceUrl: 'api/get_chats/',
        type: 'POST',
        dataType: 'json',
        paramName: 'chatgroup_mask',
        transformResult : function(response) {
            return {
                suggestions : $.map(response, function(item) {
                    return {
                        value: item.name,
                        data: item.id
                    };
                })
            };
        },
        deferRequestBy: 300
    });

    $('input.search-user').autocomplete({
        serviceUrl: 'api/get_users/',
        type: 'POST',
        dataType: 'json',
        paramName: 'user_mask',
        transformResult : function(response) {
            return {
                suggestions : $.map(response, function(item) {
                    return {
                        value: item.name,
                        data: item.id
                    };
                })
            };
        },
        deferRequestBy: 300
    });


});