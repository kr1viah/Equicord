import definePlugin from "@utils/types";
import {ChannelStore, MessageStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {Message} from "../../../packages/discord-types";
import {enableStyle} from "@api/Styles";
import textStyle from "./highlightStyle.css?managed";
import {forEach} from "lodash";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
}

function PopOverIcon() {
    return (
        <svg fill="var(--text-default)" width={24} height={24} viewBox={"0 0 64 64"}>
            <rect x="3" y="5" width="60" height="56" rx="2" ry="2" stroke-width="2"/>
            <path d="M7 12l3 3 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    );
}

function handleMessage(message: Message) {
    const domElement = document.getElementById(
        `chat-messages-${message.channel_id}-${message.id}`,
    );
    if (!domElement) return;

    enableStyle(textStyle);
    if (selectedMessages.includes(message)) {
        selectedMessages.splice(selectedMessages.indexOf(message), 1)
        domElement.classList.toggle("messageselector-selected", false)
    } else {
        let msg: Message | undefined = selectedMessages.find(m2 => m2.id === message.id);
        if (msg) {
            while (msg) {
                selectedMessages.splice(selectedMessages.indexOf(msg), 1)
                msg = selectedMessages.find(m2 => m2.id === message.id)
            }
            domElement.classList.toggle("messageselector-selected", false)
            return;
        }
        selectedMessages.push(message)
        domElement.classList.toggle("messageselector-selected", true)
    }
}

const selectedMessages: Message[] = []

export function getSelectedMessages() {
    let updatedMessages: Message[] = []

    selectedMessages.forEach((message: Message) => {
        message = MessageStore.getMessage(message.channel_id, message.id) ?? message;
        updatedMessages.push(message)
    })
    updatedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return updatedMessages
}

function isBetween(target: Date, date1: Date, date2: Date): boolean {
    const t = target.getTime();
    const a = date1.getTime();
    const b = date2.getTime();

    return t >= Math.min(a, b) && t <= Math.max(a, b);
}

function selectMessage(message: Message) {
    const domElement = document.getElementById(
        `chat-messages-${message.channel_id}-${message.id}`,
    );
    if (!domElement) return;

    enableStyle(textStyle);
    if (!selectedMessages.includes(message)) {
        let msg: Message | undefined = selectedMessages.find(m2 => m2.id === message.id);
        if (msg) {
            while (msg) {
                selectedMessages.splice(selectedMessages.indexOf(msg), 1)
                msg = selectedMessages.find(m2 => m2.id === message.id)
            }
            domElement.classList.toggle("messageselector-selected", false)
            return;
        }
        selectedMessages.push(message)
        domElement.classList.toggle("messageselector-selected", true)
    }
}

export default definePlugin({
    name: "MultiSelect",
    description: "Allows you to select (multiple) messages",
    authors: [{
        name: "kr1v",
        id: 1082702127014625371n
    }],

    onMessageClick(clickedMessage, channel, event) {
        if (event.ctrlKey) {
            handleMessage(clickedMessage)
        } else if (event.shiftKey) {
            const firstSelectedMessage = selectedMessages[0]
            if (selectedMessages.length === 1 && firstSelectedMessage.id !== clickedMessage.id) {
                const messages: Message[] =  MessageStore.getMessages(channel.id)
                messages.forEach(message => {
                    if (isBetween(message.timestamp, clickedMessage.timestamp, firstSelectedMessage.timestamp)) {
                        selectMessage(message)
                    }
                })
            } else {
                handleMessage(clickedMessage)
            }
        }
    },

    flux: {
        async CHANNEL_SELECT({ guildId, channelId }: ChannelSelectEvent) {
            selectedMessages.length = 0
        }
    }
});
