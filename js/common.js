$(function() {

    var chats = [];
    var msgList = [];
    var search_term;
    var user_mask;
    var chatgroup_mask;
    var selected_chats = [];
    var prevScrollPosition = -1;


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
                var msgTemplate1 = $('#message-template').html();
                var msgTemplate2 = $('#message-template-without-author').html();
                var groupNameTmpl = $('#group-name-template').html();
                var html = "";
                var prevGroupId = 0;
                var prevUserId = 0;
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
                    if (item.chatgroup_id != prevGroupId) {
                        html += Mustache.to_html(groupNameTmpl, { chatgroup_name: item.chatgroup_name, chatgroup_id: item.chatgroup_id });
                        prevGroupId = item.chatgroup_id;
                        prevUserId = 0;
                    };
                    html += Mustache.to_html(item.sender_id == prevUserId ? msgTemplate2 : msgTemplate1, {
                        chatId: item.chatgroup_id,
                        messageId: item.msgid,
                        author: item.sender_name,
                        text: item.contents,
                        time: getFormattedTime(item.ts)
                    });
                    prevUserId = item.sender_id;
                // console.log('chats after first ajax: ', chats);
                });
                $("#messages").html(html);
            },
            error: function( req, status, err ) {
                alert('ERROR getting json messages: '+ status);
            }
        });
    }

    // форма поиска
    $('#search_form').on('submit', function(e) {
        e.preventDefault();

        // поисковая фраза
        search_term = $('#search_term').val().toLowerCase();
        user_mask = $('#search_user').val();
        chatgroup_mask = $('#search_chat').val();

        refreshChatList(chatgroup_mask || '.*');
        // выполняем запрос
        makeFirstAjax({
            search_term: search_term || '.*',
            user_mask: user_mask || '.*',
            selected_chats: {},
            chatgroup_mask: chatgroup_mask || '.*'
        });
        return false;
    });

    $('#search_chat').autocomplete({
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

    $('#search_user').autocomplete({
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

    function refreshChatList(chatGroupMask) {   
        $.ajax({
            url: "api/get_chats/",
            data: {
                'chatgroup_mask': chatGroupMask
            },
            type: "POST",
            dataType: "json",
            success: function(data) {
                $('.chats-list-wrap').html('');
                data.forEach(function(item, index) {
                    var template = $('#chat-list').html();
                    var html = Mustache.to_html(template, {
                        chatId: item.id,
                        chatName: item.name
                    });
                    $('.chats-list-wrap').append(html);
                });
            },
            error: function( req, status, err ) {
                alert('ERROR getting json messages: '+ status);
            }
        });
    };

    $('#search_chat').on('focus', function (e) {
        e.preventDefault();
        refreshChatList($('#search_chat').val() || '.*');
    });
    $('#chat__messages').on('scroll', function (e) { $("#search_user").val($('#chat__messages').scrollTop() + ":" + ($('#chat__messages').get(0).scrollHeight - $('#chat__messages').height())); });

});